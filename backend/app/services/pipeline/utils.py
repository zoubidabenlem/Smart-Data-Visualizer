#backend\app\services\pipeline\utils.py
from datetime import datetime
import hashlib
import json
import pandas as pd
import numpy as np
from fastapi.encoders import jsonable_encoder
from typing import Any,List,Dict
from typing import List, Dict, Any, cast
import numpy as np
import math
from pathlib import Path
from app.core.logging_config import logger
from app.core.cache import dataset_df_cache
from app.models.dataset import SourceType

def dataframe_to_json_safe(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Convert DataFrame to JSON‑safe list of dicts.
    - Replaces NaN, NaT, Inf, -Inf with None.
    - Converts datetime/Timestamp columns to ISO 8601 strings.
    - Converts timedelta columns to strings.
    """
    # Work on a copy to avoid mutating original
    df_clean = df.copy()

    # Replace infinities with NaN first so they become None later
    df_clean = df_clean.replace([np.inf, -np.inf], np.nan)

    # Convert datetime and timedelta columns to ISO strings / readable strings
    for col in df_clean.columns:
        if pd.api.types.is_datetime64_any_dtype(df_clean[col]):
            # Convert to ISO 8601 string 
            df_clean[col] = df_clean[col].dt.strftime('%Y-%m-%dT%H:%M:%S')
        elif pd.api.types.is_timedelta64_dtype(df_clean[col]):
            # Convert timedelta to string representation
            df_clean[col] = df_clean[col].apply(
                lambda x: str(x) if pd.notnull(x) else None
            )
            # -- NEW: handle date columns (e.g., from MySQL DATE type)
        elif df_clean[col].dtype == 'object':
            # Check if the column actually contains datetime.date objects
            sample = df_clean[col].dropna()
            if len(sample) > 0 and isinstance(sample.iloc[0], datetime.date):
                df_clean[col] = df_clean[col].apply(
                    lambda x: x.isoformat() if isinstance(x, datetime.date) else x
                )

    # Replace NaN and NaT with None
    df_clean = df_clean.where(pd.notnull(df_clean), None)

    return df_clean.to_dict(orient="records")  # type: ignore



def sanitize_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deep‑clean a list of dicts to remove NaN/Inf values.
    Returns a new list of dicts with all NaN/Inf replaced by None.
    """
    def _clean_value(obj: Any) -> Any:
        if isinstance(obj, dict):
            # Force all keys to strings (safety net for any non‑string keys)
            return {str(k): _clean_value(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_clean_value(item) for item in obj]
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
        if isinstance(obj, np.generic):
            try:
                py_obj = obj.item()
                if isinstance(py_obj, float) and (math.isnan(py_obj) or math.isinf(py_obj)):
                    return None
                return py_obj
            except:
                return obj
        return obj

    cleaned = _clean_value(records)
    return cast(List[Dict[str, Any]], cleaned)


def get_prepared_cache_key(dataset_id: int, params: dict) -> str:
    params_str = json.dumps(params, sort_keys=True)
    params_hash = hashlib.md5(params_str.encode()).hexdigest()
    return f"prepare:{dataset_id}:{params_hash}"

# Helper to build preview cache key with refined/original distinction
def preview_cache_key(dataset_id: int, is_refined: bool) -> str:
    suffix = "refined" if is_refined else "original"
    return f"{dataset_id}_{suffix}"

from app.core.cache import dataset_df_cache   # import the global cache

def _load_dataframe(dataset, refined_df_cache=None) -> pd.DataFrame:
    """
    Return the most up‑to‑date DataFrame for the given dataset.
    Cached by dataset id + upload timestamp (version-aware).
    """
    cache_key = f"df:{dataset.id}:{dataset.uploaded_at.timestamp()}"
    
    if cache_key in dataset_df_cache:
        logger.info(f"Using cached DataFrame for dataset {dataset.id}")
        return dataset_df_cache[cache_key]

    logger.info(f"DataFrame cache MISS for dataset {dataset.id}, loading from disk")

    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise FileNotFoundError(f"Source file not found: {file_path}")

    if dataset.source_type == SourceType.csv:
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)

    # Store in global cache for next requests
    dataset_df_cache[cache_key] = df
    logger.info(f"Loaded and cached DataFrame for dataset {dataset.id}, rows={len(df)}")
    return df

# Add this helper near the top of dashboard_router.py
def format_chart_data(data: List[dict], decimals: int = 2) -> List[dict]:
    """Recursively round float values in chart_data to given decimals."""
    if not data:
        return data
    formatted = []
    for row in data:
        new_row = {}
        for k, v in row.items():
            if isinstance(v, float):
                # Round, but keep as float (frontend can still format further)
                new_row[k] = round(v, decimals)
            elif isinstance(v, dict):
                new_row[k] = format_chart_data([v], decimals)[0]
            elif isinstance(v, list):
                new_row[k] = [format_chart_data([item], decimals)[0] if isinstance(item, dict) else item for item in v]
            else:
                new_row[k] = v
        formatted.append(new_row)
    return formatted

