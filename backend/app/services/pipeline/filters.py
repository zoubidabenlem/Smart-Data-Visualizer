import pandas as pd
from typing import List
from app.schemas.pipeline import FilterCondition

def apply_filters(df: pd.DataFrame, filters: List[FilterCondition]) -> pd.DataFrame:
    result = df.copy()
    for f in filters:
        col = f.column
        if col not in result.columns:
            raise ValueError(f"Column '{col}' not found in dataset")
        op = f.operator
        val = f.value

        if op == ">":
            result = result[result[col] > val]
        elif op == "<":
            result = result[result[col] < val]
        elif op == "==":
            result = result[result[col] == val]
        elif op == "!=":
            result = result[result[col] != val]
        elif op == "in":
            result = result[result[col].isin(val)]
        elif op == "like":
            # string contains (case-insensitive)
            result = result[result[col].astype(str).str.contains(str(val), case=False, na=False)]
        else:
            raise ValueError(f"Unsupported operator: {op}")
    return result