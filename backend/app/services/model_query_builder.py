# app/services/model_query_builder.py
import hashlib
import json
from typing import Dict, Any, List, Optional
import pandas as pd
from sqlalchemy.orm import Session, joinedload

from app.models.data_model import DataModel, ModelDataset
from app.models.table_relationship import TableRelationship
from app.core.cache import get_cache, set_cache, refined_df_cache
from app.core.config import settings
from app.core.logging_config import logger
from app.services.pipeline.utils import _load_dataframe, format_chart_data, sanitize_records
from app.services.pipeline.orchestrator import run_pipeline
from app.schemas.pipeline import PrepareRequest
from app.schemas.dashboard_schemas import WidgetConfig
from fastapi import HTTPException


def _load_model_context(model_id: int, db: Session) -> Dict[str, Any]:
    """Load DataModel with datasets and relationships."""
    model = (
        db.query(DataModel)
        .filter(DataModel.id == model_id)
        .options(
            joinedload(DataModel.datasets).joinedload(ModelDataset.dataset),
            joinedload(DataModel.relationships),
        )
        .first()
    )
    if not model:
        raise HTTPException(status_code=404, detail="Data model not found")

    dataset_frames = {}
    for link in model.datasets:
        ds = link.dataset
        if not ds:
            continue
        df = _load_dataframe(ds, refined_df_cache)
        # Prefix all columns with dataset_id to ensure uniqueness
        df = df.add_prefix(f"{ds.id}__")
        dataset_frames[ds.id] = {
            "df": df,
            "updated_at": ds.updated_at.timestamp(),
            "alias": link.alias,
        }

    return {
        "model": model,
        "datasets": dataset_frames,
        "relationships": model.relationships,
    }


def _join_datasets(model_context: Dict[str, Any]) -> pd.DataFrame:
    """Join all datasets in the model (star‑schema friendly)."""
    model = model_context["model"]
    datasets = model_context["datasets"]
    relationships = model_context["relationships"]

    if not datasets:
        raise HTTPException(status_code=400, detail="Data model contains no datasets")

    # Determine starting table: base_dataset_id or first available
    base_id = model.base_dataset_id if model.base_dataset_id in datasets else next(iter(datasets))
    joined_df = datasets[base_id]["df"].copy()
    processed = {base_id}
    remaining = set(datasets.keys()) - processed

    while remaining:
        progressed = False
        for rel in relationships:
            # Join if one side is already processed and the other is remaining
            if rel.left_dataset_id in processed and rel.right_dataset_id in remaining:
                right_df = datasets[rel.right_dataset_id]["df"]
                joined_df = joined_df.merge(
                    right_df,
                    left_on=f"{rel.left_dataset_id}__{rel.left_column}",
                    right_on=f"{rel.right_dataset_id}__{rel.right_column}",
                    how=rel.join_type.lower(),
                    suffixes=("", ""),  # we already prefixed, no extra suffix
                )
                processed.add(rel.right_dataset_id)
                remaining.remove(rel.right_dataset_id)
                progressed = True
            elif rel.right_dataset_id in processed and rel.left_dataset_id in remaining:
                left_df = datasets[rel.left_dataset_id]["df"]
                joined_df = joined_df.merge(
                    left_df,
                    left_on=f"{rel.right_dataset_id}__{rel.right_column}",
                    right_on=f"{rel.left_dataset_id}__{rel.left_column}",
                    how=rel.join_type.lower(),
                    suffixes=("", ""),
                )
                processed.add(rel.left_dataset_id)
                remaining.remove(rel.left_dataset_id)
                progressed = True

        if not progressed:
            break

    if remaining:
        raise HTTPException(
            status_code=400,
            detail="Could not join all datasets. Check relationships are connected.",
        )
    return joined_df


def _widget_config_to_prepare_request(
    config: WidgetConfig, joined_columns: List[str]
) -> PrepareRequest:
    """
    Convert a multi‑table WidgetConfig into a single‑table PrepareRequest.
    All column references are resolved to the fully qualified names in the joined DataFrame.
    """
    # Helper to build the full column name
    def resolve_col(dataset_id: int, column: str) -> str:
        full_name = f"{dataset_id}__{column}"
        if full_name not in joined_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Column '{column}' from dataset {dataset_id} not found in joined data.",
            )
        return full_name

    # Convert dimensions to group_by
    group_by = [resolve_col(d.dataset_id, d.column) for d in config.dimensions]

    # Convert measures to aggregations
    aggregations = []
    for m in config.measures:
        aggregations.append(
            {
                "value_col": resolve_col(m.dataset_id, m.column),
                "agg_func": m.aggregation,
                "alias": m.alias or f"{m.column}_{m.aggregation}",
            }
        )

    # Convert filters (assume ModelFilterCondition has dataset_id, column, operator, value)
    filters = []
    for f in config.filters:
        filters.append(
            {
                "column": resolve_col(f.dataset_id, f.column),
                "operator": f.operator,
                "value": f.value,
            }
        )

    # Prepare missing_config: remap overrides to qualified column names
    missing_config = None
    if config.missing_config:
        missing_config = config.missing_config.dict()
        if missing_config.get("overrides"):
            new_overrides = {}
            for col, override in missing_config["overrides"].items():
                # The key is plain column name; we need to know which dataset it belongs to.
                # Simplification: assume no collisions; find the qualified name by checking suffix.
                # We'll assume the config missing_config was built with plain names and all datasets unique.
                # To be safe, we raise if ambiguous.
                matches = [c for c in joined_columns if c.endswith(f"__{col}")]
                if len(matches) != 1:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Ambiguous or missing column '{col}' for missing_config override.",
                    )
                new_overrides[matches[0]] = override
            missing_config["overrides"] = new_overrides

    # Build the PrepareRequest dict
    prepare_dict = {
        "filters": filters,
        "group_by": group_by,
        "aggregations": aggregations,
        "missing_config": missing_config,
    }

    # Validate and create PrepareRequest
    try:
        return PrepareRequest(**prepare_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid prepare parameters: {e}")


def get_chart_data_for_config(
    model_id: int, config: WidgetConfig, db: Session
) -> List[Dict[str, Any]]:
    """
    Load model, join datasets, run pipeline and return chart data.
    Also applies order_by and limit if present in config.
    """
    model_context = _load_model_context(model_id, db)
    joined_df = _join_datasets(model_context)

    # 1. Convert WidgetConfig to PrepareRequest
    prepare_params = _widget_config_to_prepare_request(config, list(joined_df.columns))

    # 2. Cache key based on model datasets versions and config
    ds_versions = {
        ds_id: info["updated_at"] for ds_id, info in model_context["datasets"].items()
    }
    config_dict = config.dict()
    params_hash = hashlib.md5(
        json.dumps(config_dict, sort_keys=True, default=str).encode()
    ).hexdigest()
    ds_hash = hashlib.md5(
        json.dumps(ds_versions, sort_keys=True, default=str).encode()
    ).hexdigest()
    cache_key = f"model_chart:{model_id}:{ds_hash}:{params_hash}"

    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    # 3. Run the existing pipeline (missing, filters, aggregation)
    try:
        chart_data = run_pipeline(joined_df, prepare_params)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Pipeline error in model query builder")
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

    # 4. Apply order_by and limit (not handled by pipeline)
    if config.order_by:
        # chart_data is a list of dicts; sort them
        for order in config.order_by:
            # order.field may be a fully qualified column or an alias from measures
            # We assume order.field is the alias of an aggregation or a dimension column name.
            # For simplicity, sort by the field name directly.
            reverse = order.direction == "desc"
            try:
                chart_data.sort(key=lambda x: x.get(order.field, 0), reverse=reverse)
            except (TypeError, KeyError):
                logger.warning(f"Unable to sort by field {order.field}")
        if config.limit is not None:
            chart_data = chart_data[: config.limit]

    # 5. Format (round floats) and sanitize
    chart_data = format_chart_data(chart_data)
    chart_data = sanitize_records(chart_data)

    # 6. Cache and return
    set_cache(cache_key, chart_data, ttl=settings.cache_ttl_seconds)
    return chart_data