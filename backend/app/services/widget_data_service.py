# app/services/widget_data_service.py
import hashlib
import json
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.data_model import DataModel, ModelDataset
from app.models.dataset import Dataset
from app.models.table_relationship import TableRelationship
from app.schemas.dashboard_schemas import WidgetConfig, ColumnRef, MeasureSpec
from app.schemas.pipeline import AggregationSpec, FilterCondition, MissingConfig
from app.services.dataset_loader import DatasetLoader
from app.services.pipeline.aggregations import apply_aggregation
from app.services.pipeline.missing import apply_missing_strategy_per_column
from app.services.pipeline.filters import apply_filters
from app.core.cache import get_cache, set_cache
from app.core.logging_config import logger


def get_widget_data(model_id: int, config: WidgetConfig, db: Session) -> List[Dict[str, Any]]:
    """
    Main entry point: fetch joined data for a widget config.
    """
    # 1. Cache key
    cache_key = _get_cache_key(model_id, config)
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    # 2. Load model with datasets and relationships
    model = db.query(DataModel).filter(DataModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # 3. Validate config against model
    _validate_config_against_model(model, config, db)

    # 4. Build joined DataFrame
    df = _build_joined_dataframe(model, config, db)

    # 5. Apply filters (before aggregation)
    if config.filters:
        # Map filters to prefixed column names
        df = _apply_filters_on_joined_df(df, config, model, db)

    # 6. Handle missing values
    if config.missing_config:
        missing_config = config.missing_config
    else:
        # Default: no missing handling, equivalent to drop? Actually schema default is "drop".
        missing_config = MissingConfig(default="drop")
    df = apply_missing_strategy_per_column(df, missing_config)

    # 7. Aggregate (group by dimensions, aggregate measures)
    result_df = _apply_aggregation_on_joined_df(df, config, model)

    # 8. Apply order_by and limit
    result_df = _apply_order_and_limit(result_df, config)

    # 9. Convert to list of dicts (JSON‑safe)
    result = result_df.to_dict(orient="records")

    # 10. Cache and return
    set_cache(cache_key, result, ttl=300)  # 5 minutes
    return result


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
# Inside app/services/widget_data_service.py

def _get_cache_key(model_id: int, config: WidgetConfig) -> str:
    """Generate a stable cache key from model id and config."""
    # Dump to a Python dict first, then serialize with sort_keys=True
    config_dict = config.model_dump(mode='json')
    config_json = json.dumps(config_dict, sort_keys=True)
    config_hash = hashlib.md5(config_json.encode()).hexdigest()
    return f"widget_data:{model_id}:{config_hash}"

def _validate_config_against_model(model: DataModel, config: WidgetConfig, db: Session):
    """
    Verify that all referenced dataset IDs and column names exist in the model.
    """
    # Collect all dataset_ids referenced in dimensions, measures, filters
    ref_dataset_ids = set()
    for dim in config.dimensions:
        ref_dataset_ids.add(dim.dataset_id)
    for meas in config.measures:
        ref_dataset_ids.add(meas.dataset_id)
    for filt in config.filters:
        ref_dataset_ids.add(filt.dataset_id)

    # Check that each dataset belongs to the model
    model_dataset_ids = {md.dataset_id for md in model.datasets}
    for ds_id in ref_dataset_ids:
        if ds_id not in model_dataset_ids:
            raise HTTPException(
                status_code=422,
                detail=f"Dataset {ds_id} is not part of model {model.id}"
            )

    # Helper: get dataset and its column names
    def get_dataset_columns(dataset_id: int) -> set:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
        # Use refined schema if available, else raw column schema
        schema = dataset.refined_column_schema or dataset.column_schema
        if not schema:
            return set()
        if isinstance(schema, dict):
            return set(schema.keys())
        elif isinstance(schema, list):
            return {col.get("name") for col in schema if isinstance(col, dict) and "name" in col}
        else:
            return set()

    # Validate each column reference
    for dim in config.dimensions:
        cols = get_dataset_columns(dim.dataset_id)
        if dim.column not in cols:
            raise HTTPException(
                status_code=422,
                detail=f"Column '{dim.column}' not found in dataset {dim.dataset_id}"
            )
    for meas in config.measures:
        cols = get_dataset_columns(meas.dataset_id)
        if meas.column not in cols:
            raise HTTPException(
                status_code=422,
                detail=f"Column '{meas.column}' not found in dataset {meas.dataset_id}"
            )
    for filt in config.filters:
        cols = get_dataset_columns(filt.dataset_id)
        if filt.column not in cols:
            raise HTTPException(
                status_code=422,
                detail=f"Column '{filt.column}' not found in dataset {filt.dataset_id}"
            )


def _build_joined_dataframe(model: DataModel, config: WidgetConfig, db: Session) -> pd.DataFrame:
    """
    Build a star‑schema joined DataFrame.
    - Determine fact table (base_dataset_id or inferred from measures).
    - Load fact DataFrame and prefix columns.
    - For each other referenced dataset, find a many‑to‑one relationship
      from fact to dimension and left join.
    """
    # Determine fact dataset id
    fact_dataset_id = model.base_dataset_id
    if fact_dataset_id is None:
        # Infer: first dataset that appears in a measure
        if config.measures:
            fact_dataset_id = config.measures[0].dataset_id
        elif config.dimensions:
            fact_dataset_id = config.dimensions[0].dataset_id
        else:
            raise HTTPException(status_code=400, detail="Cannot determine fact table")

    fact_dataset = db.query(Dataset).filter(Dataset.id == fact_dataset_id).first()
    if not fact_dataset:
        raise HTTPException(status_code=404, detail="Fact dataset not found")

    # Load fact DataFrame and prefix columns
    df = DatasetLoader.load_dataframe(fact_dataset, db)
    df = _prefix_columns(df, fact_dataset_id)

    # Collect all other dataset ids referenced in config
    other_dataset_ids = set()
    for dim in config.dimensions:
        if dim.dataset_id != fact_dataset_id:
            other_dataset_ids.add(dim.dataset_id)
    for meas in config.measures:
        if meas.dataset_id != fact_dataset_id:
            other_dataset_ids.add(meas.dataset_id)
    for filt in config.filters:
        if filt.dataset_id != fact_dataset_id:
            other_dataset_ids.add(filt.dataset_id)

    # For each other dataset, find relationship and join
    for ds_id in other_dataset_ids:
        dim_dataset = db.query(Dataset).filter(Dataset.id == ds_id).first()
        if not dim_dataset:
            raise HTTPException(status_code=404, detail=f"Dataset {ds_id} not found")

        # Find relationship where fact is many-side, dim is one-side
        rel = _find_star_relationship(model, fact_dataset_id, ds_id, db)
        if not rel:
            raise HTTPException(
                status_code=400,
                detail=f"No valid many-to-one relationship found between dataset {fact_dataset_id} and {ds_id}"
            )

        # Load dimension DataFrame and prefix
        dim_df = DatasetLoader.load_dataframe(dim_dataset, db)
        dim_df = _prefix_columns(dim_df, ds_id)

        # Determine join keys (prefixed) - FIXED MAPPING
        if rel.left_dataset_id == fact_dataset_id:
            left_on = f"ds{fact_dataset_id}_{rel.left_column}"
            right_on = f"ds{ds_id}_{rel.right_column}"
        else:
            left_on = f"ds{fact_dataset_id}_{rel.right_column}"
            right_on = f"ds{ds_id}_{rel.left_column}"

        # Perform left join
        df = df.merge(dim_df, left_on=left_on, right_on=right_on, how='left', suffixes=('', '_y'))
        # Drop duplicate join key columns if any (e.g., right_on appears twice)
        df = df.loc[:, ~df.columns.duplicated()]

    return df


def _find_star_relationship(model: DataModel, fact_ds_id: int, dim_ds_id: int, db: Session):
    """
    Find a relationship where one side is fact (many) and other is dim (one).
    Returns the TableRelationship object or None.
    """
    return db.query(TableRelationship).filter(
        TableRelationship.model_id == model.id,
        (
            (
                (TableRelationship.left_dataset_id == fact_ds_id) &
                (TableRelationship.right_dataset_id == dim_ds_id) &
                (TableRelationship.cardinality == 'many_to_one')  # Fact is many, Dim is one
            ) |
            (
                (TableRelationship.left_dataset_id == dim_ds_id) &
                (TableRelationship.right_dataset_id == fact_ds_id) &
                (TableRelationship.cardinality == 'one_to_many')  # Dim is one, Fact is many
            )
        )
    ).first()


def _prefix_columns(df: pd.DataFrame, dataset_id: int) -> pd.DataFrame:
    """Rename columns to include dataset id prefix to avoid collisions."""
    df.columns = [f"ds{dataset_id}_{col}" for col in df.columns]
    return df


def _apply_filters_on_joined_df(df: pd.DataFrame, config: WidgetConfig, model: DataModel, db: Session) -> pd.DataFrame:
    """
    Apply filters using prefixed column names.
    """
    # For each filter, translate column to prefixed name
    translated_filters = []
    for filt in config.filters:
        prefixed_col = f"ds{filt.dataset_id}_{filt.column}"
        if prefixed_col not in df.columns:
            raise HTTPException(
                status_code=422,
                detail=f"Filter column '{filt.column}' not found in joined data"
            )
        translated_filters.append(
            FilterCondition(column=prefixed_col, operator=filt.operator, value=filt.value)
        )
    return apply_filters(df, translated_filters)


def _apply_aggregation_on_joined_df(
    df: pd.DataFrame, config: WidgetConfig, model: DataModel
) -> pd.DataFrame:
    """
    Group by dimensions and aggregate measures.

    Special case: scatter with no dimensions returns RAW measure values
    (one point per source row), not a single aggregated row.
    """
    # ─── Scatter, no dimensions → raw scatter data ───
    if config.chart_type == "scatter" and not config.dimensions:
        if len(config.measures) < 2:
            raise HTTPException(
                status_code=422,
                detail="Scatter chart requires at least 2 measures",
            )

        out = {}
        for meas in config.measures:
            prefixed = f"ds{meas.dataset_id}_{meas.column}"
            if prefixed not in df.columns:
                raise HTTPException(
                    status_code=422,
                    detail=f"Measure column '{meas.column}' not found in joined data",
                )
            alias = meas.alias or meas.column
            out[alias] = df[prefixed]

        result = pd.DataFrame(out)

        # Drop rows with NaN in any measure
        result = result.dropna()

        # Cap to a sane number to protect the browser.
        cap = config.limit if config.limit is not None else 5000
        result = result.head(cap).reset_index(drop=True)
        return result

    # ─── No measures → unique dimension combos ───
    if not config.measures:
        if config.dimensions:
            prefixed_dims = [
                f"ds{d.dataset_id}_{d.column}" for d in config.dimensions
            ]
            result = df[prefixed_dims].drop_duplicates().reset_index(drop=True)
            return _strip_dimension_prefix(result, config)
        raise HTTPException(
            status_code=400,
            detail="Widget must have at least one dimension or measure",
        )

    # ─── Standard group-by aggregation ───
    group_by_cols = [f"ds{d.dataset_id}_{d.column}" for d in config.dimensions]

    from app.schemas.pipeline import AggregationSpec as PipelineAggSpec

    pipeline_specs = []
    for meas in config.measures:
        prefixed_col = f"ds{meas.dataset_id}_{meas.column}"
        if prefixed_col not in df.columns:
            raise HTTPException(
                status_code=422,
                detail=f"Measure column '{meas.column}' not found in joined data",
            )
        # Fallback alias matches the frontend's expectation (measure column name).
        alias = meas.alias or meas.column
        pipeline_specs.append(
            PipelineAggSpec(
                value_col=prefixed_col,
                agg_func=meas.aggregation,
                alias=alias,
            )
        )

    result = apply_aggregation(df, group_by=group_by_cols, aggregations=pipeline_specs)

    # ─── KEY FIX: rename prefixed dim columns back to bare column names ───
    return _strip_dimension_prefix(result, config)


def _strip_dimension_prefix(result: pd.DataFrame, config: WidgetConfig) -> pd.DataFrame:
    """
    The aggregation keeps 'ds{id}_{column}' prefixed names for group_by.
    The frontend expects the bare column name (e.g. 'product_category').
    Rename them so chart_data keys line up with config.dimensions[].column.
    """
    rename_map = {}
    for dim in config.dimensions:
        prefixed = f"ds{dim.dataset_id}_{dim.column}"
        if prefixed in result.columns:
            # If two dims from different datasets share a bare name, prefer keeping
            # the first one bare and leave subsequent ones prefixed to avoid a clash.
            if dim.column in rename_map.values():
                continue
            rename_map[prefixed] = dim.column

    if rename_map:
        result = result.rename(columns=rename_map)
    return result


def _apply_order_and_limit(df: pd.DataFrame, config: WidgetConfig) -> pd.DataFrame:
    """Apply sorting and row limit."""
    if config.order_by:
        # Order by columns may refer to aliases or prefixed columns
        sort_columns = []
        ascending = []
        for order in config.order_by:
            # Try to resolve alias or prefixed column
            col = order.field
            if col in df.columns:
                sort_columns.append(col)
            else:
                # Maybe it's a measure alias or dimension prefixed name
                # Already alias as per aggregation output
                if order.alias:
                    col = order.alias
                    if col in df.columns:
                        sort_columns.append(col)
                    else:
                        logger.warning(f"Order column {order.field} not found")
                        continue
                else:
                    logger.warning(f"Order column {order.field} not found")
                    continue
            ascending.append(order.direction == "asc")
        if sort_columns:
            df = df.sort_values(by=sort_columns, ascending=ascending)

    if config.limit is not None:
        df = df.head(config.limit)
    return df

