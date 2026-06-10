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
            return {k: _clean_value(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_clean_value(item) for item in obj]
        # handle numpy floats that may be NaN/Inf
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
        # Handle numpy generic numbers (e.g., np.int64, np.float32)
        if isinstance(obj, np.generic):  # numpy scalar
            try:
                # Convert to Python native, then check for NaN/Inf again
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

def _load_dataframe(dataset, refined_df_cache) -> pd.DataFrame:

    """
    Return the most up‑to‑date DataFrame for the given dataset.
    Logic:
    - If dataset.is_refined is True and a refined version is cached → use that.
    - Otherwise, read the original file from source_path.
    """
    if dataset.is_refined:
        refined_key = f"refined:{dataset.id}"          # use the same key pattern as your prepare endpoint
        if refined_key in refined_df_cache:
            logger.info(f"Using refined DataFrame for dataset {dataset.id}")
            return refined_df_cache[refined_key]

    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise FileNotFoundError(f"Source file not found: {file_path}")

    if dataset.source_type == SourceType.csv:
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)
    logger.info(f"Loaded original DataFrame for dataset {dataset.id}, rows={len(df)}")
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

