import pandas as pd

def apply_missing_strategy(df: pd.DataFrame, strategy: str, fill_value=None) :
    if strategy == "drop":
        return df.dropna()
    elif strategy == "fill":
        if fill_value is None:
            raise ValueError("fill_value must be provided for 'fill' strategy")
        return df.fillna(fill_value)
    elif strategy == "mean":
        # Only fill numeric columns with their mean
        numeric_cols = df.select_dtypes(include='number').columns
        df_copy = df.copy()
        for col in numeric_cols:
            df_copy[col] = df_copy[col].fillna(df_copy[col].mean())
        return df_copy
    else:
        raise ValueError(f"Unknown missing strategy: {strategy}")