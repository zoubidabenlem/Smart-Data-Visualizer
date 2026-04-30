import pandas as pd
from app.schemas.pipeline import MissingConfig, MissingOverride

def apply_missing_strategy_per_column(df: pd.DataFrame, config: MissingConfig) -> pd.DataFrame:
    """
    Apply missing value strategies column by column.
    For each column:
        - Use override if present, else default.
        - Strategy 'drop' → remove rows where this column is null.
        - Strategy 'fill' → replace nulls with fill_value (type‑checked).
        - Strategy 'mean' → fill numeric columns with their mean; non‑numeric columns are left as is.
    """
    df = df.copy()
    for col in df.columns:
        # 1. Determine strategy and fill value
        override = config.overrides.get(col) if config.overrides else None
        if override is not None:
            if isinstance(override, str):
                strat = override
                fill = None
            else:  # MissingOverride
                strat = override.strategy
                fill = override.fill_value
        else:
            strat = config.default
            fill = config.default_fill_value if strat == "fill" else None

        # 2. Apply strategy
        if strat == "drop":
            df = df[df[col].notna()]
        elif strat == "fill":
            if fill is None:
                raise ValueError(f"fill_value required for column '{col}' with 'fill' strategy.")
            # Type conversion for numeric columns
            if pd.api.types.is_numeric_dtype(df[col]):
                if not isinstance(fill, (int, float)):
                    try:
                        fill = float(fill)
                    except (ValueError, TypeError):
                        raise ValueError(f"fill_value for numeric column '{col}' must be a number, got {fill}")
            df[col] = df[col].fillna(fill)
        elif strat == "mean":
            if pd.api.types.is_numeric_dtype(df[col]):
                mean_val = df[col].mean()
                df[col] = df[col].fillna(mean_val)
            # else: nothing – non‑numeric columns stay as is (None after serialisation)
        else:
            raise ValueError(f"Unknown strategy '{strat}' for column '{col}'.")

    return df

# Legacy wrapper – keep for backward compatibility (if called elsewhere)
def apply_missing_strategy(df: pd.DataFrame, strategy: str, fill_value=None) -> pd.DataFrame:
    config = MissingConfig(default=strategy, default_fill_value=fill_value if strategy == "fill" else None) # type: ignore
    return apply_missing_strategy_per_column(df, config)