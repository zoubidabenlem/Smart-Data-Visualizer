# app/services/pipeline/orchestrator.py
import time
import pandas as pd
from typing import List, Dict, Any
from app.services.pipeline.missing import apply_missing_strategy_per_column
from app.services.pipeline.filters import apply_filters
from app.services.pipeline.aggregations import apply_aggregation
from app.schemas.pipeline import PrepareRequest
from app.services.pipeline.utils import dataframe_to_json_safe, sanitize_records
from app.core.logging_config import logger

def run_pipeline(df: pd.DataFrame, params: PrepareRequest) -> List[Dict[str, Any]]:
    start_total = time.time()
    logger.info(f"Pipeline start: input rows={len(df)}")

    # 1. Missing values
    start = time.time()
    missing_config = params.effective_missing_config
    df_clean = apply_missing_strategy_per_column(df, missing_config)
    missing_time = (time.time() - start) * 1000
    logger.info(f"Missing value step: input rows={len(df)} -> output rows={len(df_clean)} | elapsed={missing_time:.2f} ms")

    # 2. Filters
    start = time.time()
    if params.filters:
        df_clean = apply_filters(df_clean, params.filters)
    filter_time = (time.time() - start) * 1000
    logger.info(f"Filter step: rows after={len(df_clean)} | elapsed={filter_time:.2f} ms")

    # 3. Aggregation
    start = time.time()
    if params.group_by and params.agg_func:
        df_clean = apply_aggregation(df_clean, params.group_by, params.agg_func, params.value_col)
    agg_time = (time.time() - start) * 1000
    logger.info(f"Aggregation step: rows after={len(df_clean)} | elapsed={agg_time:.2f} ms")

    # 4. Serialisation
    start = time.time()
    records = dataframe_to_json_safe(df_clean)
    records = sanitize_records(records)
    records = [{str(k): v for k, v in record.items()} for record in records]
    serialise_time = (time.time() - start) * 1000
    logger.info(f"Serialisation step: output rows={len(records)} | elapsed={serialise_time:.2f} ms")

    total_time = (time.time() - start_total) * 1000
    logger.info(f"Pipeline complete: total elapsed={total_time:.2f} ms")
    return records