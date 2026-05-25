import pandas as pd
from typing import Optional, List

def apply_aggregation(
    df: pd.DataFrame,
    group_by: Optional[List[str]],
    agg_func: Optional[str],
    value_col: Optional[str]
) -> pd.DataFrame:
    # If no aggregation requested, return original DataFrame
    if not agg_func or not value_col:
        return df

    # Validate column exists
    if value_col not in df.columns:
        raise ValueError(f"Value column '{value_col}' not found")

    agg_map = {
        "SUM": "sum",
        "MEAN": "mean",
        "COUNT": "count",
        "MAX": "max",
        "MIN": "min"
    }
    pandas_agg = agg_map.get(agg_func)
    if not pandas_agg:
        raise ValueError(f"Unsupported aggregation: {agg_func}")

    # Global aggregation (no group_by)
    if not group_by or len(group_by) == 0:
        result = {value_col: getattr(df[value_col], pandas_agg)()}
        # For COUNT, also return count as integer; optionally rename
        return pd.DataFrame([result])

    # Grouped aggregation
    for col in group_by:
        if col not in df.columns:
            raise ValueError(f"Group by column '{col}' not found")

    grouped = df.groupby(group_by, as_index=False)[value_col].agg(pandas_agg)
    return pd.DataFrame(grouped)