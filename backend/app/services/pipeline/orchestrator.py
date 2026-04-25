import pandas as pd
from typing import List, Dict, Any
from app.services.pipeline.missing import apply_missing_strategy
from app.services.pipeline.filters import apply_filters
from app.services.pipeline.aggregations import apply_aggregation
from app.schemas.pipeline import PrepareRequest

def run_pipeline(df: pd.DataFrame, params: PrepareRequest) -> List[Dict[str, Any]]:
    # 1. Missing values
    df_clean = apply_missing_strategy(df, params.missing_strategy, params.fill_value)

    # 2. Filters
    if params.filters:
        df_clean = apply_filters(df_clean, params.filters)

    # 3. Aggregation
    if params.group_by and params.agg_func:
        df_clean = apply_aggregation(df_clean, params.group_by, params.agg_func, params.value_col)

    # 4. Serialize: replace NaN/NaT with None and ensure keys are strings
    df_clean = df_clean.where(pd.notnull(df_clean), None)
    records = df_clean.to_dict(orient='records')
    # Convert any non‑string keys to strings (pandas often uses strings, but this satisfies the type checker)
    records = [{str(k): v for k, v in record.items()} for record in records]
    return records