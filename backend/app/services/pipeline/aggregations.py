import pandas as pd
from typing import Optional, List

from app.schemas.pipeline import AggregationSpec

def apply_aggregation(
    df: pd.DataFrame,
    group_by: Optional[List[str]],
    aggregations: List[AggregationSpec]
) -> pd.DataFrame:
    # If no aggregation requested, return original DataFrame
    if not aggregations:
        return df


    agg_map = {
        "SUM": "sum",
        "MEAN": "mean",
        "COUNT": "count",
        "MAX": "max",
        "MIN": "min"
    }
     # Validate columns and build alias mapping
    output_aliases = set()
    agg_dict = {}

    for spec in aggregations:
        if spec.value_col not in df.columns:
            raise ValueError(f"Value column '{spec.value_col}' not found in dataset")

        func = agg_map.get(spec.agg_func)
        if not func:
            raise ValueError(f"Unsupported aggregation: {spec.agg_func}")

        # Check data type for numeric operations
        if spec.agg_func in ("SUM", "MEAN", "MAX", "MIN"):
            if not pd.api.types.is_numeric_dtype(df[spec.value_col]):
                raise TypeError(
                    f"Column '{spec.value_col}' is not numeric; cannot apply {spec.agg_func}"
                )

        # Determine output column name
        alias = spec.alias or f"{spec.value_col}_{spec.agg_func}"
        # Resolve collisions automatically if alias already used
        original_alias = alias
        counter = 1
        while alias in output_aliases:
            alias = f"{original_alias}_{counter}"
            counter += 1
        output_aliases.add(alias)

        agg_dict[alias] = pd.NamedAgg(column=spec.value_col, aggfunc=func)

    # Perform grouping
    if group_by:
        for col in group_by:
            if col not in df.columns:
                raise ValueError(f"Group by column '{col}' not found")
        result = df.groupby(group_by, as_index=False).agg(**agg_dict)
    else:
        result_row = {}
        for alias, named_agg in agg_dict.items():
            result_row[alias] = getattr(df[named_agg.column], named_agg.aggfunc)()
        result = pd.DataFrame([result_row])

    return result