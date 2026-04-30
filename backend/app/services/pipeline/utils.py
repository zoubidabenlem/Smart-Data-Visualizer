import hashlib
import json
import pandas as pd
import numpy as np
from fastapi.encoders import jsonable_encoder
from typing import Any,List,Dict
from typing import List, Dict, Any, cast
import numpy as np
import math

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

