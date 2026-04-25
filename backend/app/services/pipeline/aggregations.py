import pandas as pd
from typing import Optional, List

def apply_aggregation(
    df: pd.DataFrame,
    group_by: Optional[List[str]],
    agg_func: Optional[str],
    value_col: Optional[str]
) -> pd.DataFrame:
    # If any required parameter is missing, return original DataFrame
    if not group_by or not agg_func or not value_col:
        return df

    # Narrow types for static type checker
    assert group_by is not None and len(group_by) > 0
    assert value_col is not None and value_col != ""

    # Validate columns exist
    if value_col not in df.columns:
        raise ValueError(f"Value column '{value_col}' not found")
    for col in group_by:
        if col not in df.columns:
            raise ValueError(f"Group by column '{col}' not found")

    # Map frontend aggregation function to pandas method
    agg_map = {
        "SUM": "sum",
        "MEAN": "mean",
        "COUNT": "count"
    }
    pandas_agg = agg_map.get(agg_func)
    if not pandas_agg:
        raise ValueError(f"Unsupported aggregation: {agg_func}")

    # Perform groupby aggregation
    grouped = df.groupby(group_by, as_index=False)[value_col].agg(pandas_agg)
    # Rename aggregated column for clarity
    return pd.DataFrame(grouped)