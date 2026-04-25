import hashlib
import json
import pandas as pd
import numpy as np
from fastapi.encoders import jsonable_encoder
from typing import Any,List,Dict
from typing import List, Dict, Any, cast
import numpy as np
def dataframe_to_json_safe(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Convert DataFrame to JSON‑safe list of dicts.
    - Replaces NaN, NaT, Inf, -Inf with None.
    - Converts datetime/Timestamp columns to ISO 8601 strings.
    """
    # Work on a copy to avoid mutating original
    df_clean = df.copy()

    # Convert all datetime columns to ISO strings
    for col in df_clean.select_dtypes(include=['datetime64', 'datetime', 'timedelta']):
        df_clean[col] = df_clean[col].astype(str).replace('NaT', None)

    # Replace infinities and nulls
    df_clean = df_clean.replace([np.inf, -np.inf], None)
    df_clean = df_clean.where(pd.notnull(df_clean), None)

    return df_clean.to_dict(orient="records") #type: ignore



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
        if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
            return None
        return obj

    cleaned = _clean_value(records)
    # The caller guarantees the top-level shape, so we cast it.
    return cast(List[Dict[str, Any]], cleaned)

def get_prepared_cache_key(dataset_id: int, params: dict) -> str:
    params_str = json.dumps(params, sort_keys=True)
    params_hash = hashlib.md5(params_str.encode()).hexdigest()
    return f"prepare:{dataset_id}:{params_hash}"

