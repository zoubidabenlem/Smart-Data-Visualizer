# tests/test_refine_pipeline.py

import pandas as pd
import pytest
from app.schemas.refine_schema import ColumnRefineAction, MergeParameters
from app.services.refine_service import apply_refine_pipeline

# ----- Helpers to quickly build actions -----

def drop(col):
    return ColumnRefineAction(original_name=col, action="drop")

def rename(old, new, dtype=None):
    return ColumnRefineAction(original_name=old, action="rename", new_name=new, override_dtype=dtype)

def missing(col, strategy, fill_value=None, dtype=None):
    return ColumnRefineAction(
        original_name=col,
        action="missing",
        missing_strategy=strategy,
        missing_fill_value=fill_value,
        override_dtype=dtype,
    )

def merge(sources, target, sep=" ", drop_sources=True):
    return ColumnRefineAction(
        action="merge",
        parameters=MergeParameters(
            source_columns=sources,
            target_column=target,
            separator=sep,
            drop_sources=drop_sources,
        ),
    )

def dedup(subset, keep="first"):
    return ColumnRefineAction(action="deduplicate", subset=subset, keep=keep)


# ----- Test data -----

@pytest.fixture
def base_df():
    return pd.DataFrame({
        "A": [1, 2, 3, 4],
        "B": ["x", "y", "z", "w"],
        "C": [10.5, 20.5, 30.5, 40.5],
        "D": ["a", "b", "c", "d"],
    })


class TestApplyRefinePipeline:
    def test_empty_actions(self, base_df):
        result = apply_refine_pipeline(base_df, [])
        pd.testing.assert_frame_equal(result, base_df)

    def test_drop_existing(self, base_df):
        result = apply_refine_pipeline(base_df, [drop("B")])
        assert list(result.columns) == ["A", "C", "D"]

    def test_drop_missing_raises(self, base_df):
        with pytest.raises(ValueError, match="not found"):
            apply_refine_pipeline(base_df, [drop("X")])

    def test_rename_basic(self, base_df):
        result = apply_refine_pipeline(base_df, [rename("A", "Alpha")])
        assert "A" not in result.columns
        assert "Alpha" in result.columns

    def test_rename_missing_raises(self, base_df):
        with pytest.raises(ValueError, match="not found"):
            apply_refine_pipeline(base_df, [rename("Z", "Zed")])

    def test_rename_noop(self, base_df):
    # rename to same name does nothing (no dtype change)
        result = apply_refine_pipeline(base_df, [rename("A", "A")])
        pd.testing.assert_frame_equal(result, base_df)

    def test_rename_dtype_only(self, base_df):
        # rename to same name but change dtype
        result = apply_refine_pipeline(base_df, [rename("C", "C", dtype="string")])
        assert result["C"].dtype == "string"

    def test_rename_then_dtype(self, base_df):
        actions = [rename("A", "A_new"), rename("A_new", dtype="string")]
        result = apply_refine_pipeline(base_df, actions)
        assert "A_new" in result.columns
        assert result["A_new"].dtype == "string"

    def test_missing_drop(self, base_df):
        df = base_df.copy()
        df.loc[0, "A"] = None  # introduce NA
        result = apply_refine_pipeline(df, [missing("A", "drop")])
        assert len(result) == 3  # first row dropped

    def test_missing_fill(self, base_df):
        df = base_df.copy()
        df.loc[1, "A"] = None
        result = apply_refine_pipeline(df, [missing("A", "fill", fill_value="99")])
        assert result.loc[1, "A"] == 99  # coerced to int

    def test_missing_mean(self, base_df):
        df = base_df.copy()
        df.loc[1, "A"] = None
        result = apply_refine_pipeline(df, [missing("A", "mean")])
        # mean of (1,3,4) = 2.666...? Actually mean of [1, nan, 3, 4] = (1+3+4)/3 = 2.666... 
        # fillna with mean fills the missing row with that value
        assert result.loc[1, "A"] == pytest.approx(8/3)

    def test_missing_mean_non_numeric_raises(self, base_df):
        with pytest.raises(ValueError, match="not numeric"):
            apply_refine_pipeline(base_df, [missing("B", "mean")])

    def test_missing_fill_without_value_raises(self, base_df):
        with pytest.raises(ValueError, match="missing_fill_value required"):
            apply_refine_pipeline(base_df, [missing("A", "fill")])

    def test_merge_basic(self, base_df):
        actions = [merge(["B", "D"], target="BD", sep="-")]
        result = apply_refine_pipeline(base_df, actions)
        assert "BD" in result.columns
        assert "B" not in result.columns  # drop_sources=True
        assert "D" not in result.columns
        assert result.loc[0, "BD"] == "x-a"

    def test_merge_no_drop(self, base_df):
        actions = [merge(["B", "D"], target="BD", drop_sources=False)]
        result = apply_refine_pipeline(base_df, actions)
        assert "B" in result.columns
        assert "D" in result.columns
        assert "BD" in result.columns

    def test_merge_missing_source_raises(self, base_df):
        with pytest.raises(ValueError, match="source columns not found"):
            apply_refine_pipeline(base_df, [merge(["B", "X"], target="BX")])

    def test_merge_target_exists_not_source_raises(self, base_df):
        # target "A" already exists and is not a source -> error
        with pytest.raises(ValueError, match="already exists"):
            apply_refine_pipeline(base_df, [merge(["B", "D"], target="A")])

    def test_merge_target_is_source_ok(self, base_df):
        # target = "B" (one of the sources) → allowed, original B gets overwritten
        actions = [merge(["B", "D"], target="B", drop_sources=False)]
        result = apply_refine_pipeline(base_df, actions)
        assert result.loc[0, "B"] == "x a"  # merged value (space sep)
        assert "D" in result.columns  # not dropped

    def test_deduplicate(self):
        df = pd.DataFrame({"A": [1, 1, 2], "B": [3, 3, 4]})
        result = apply_refine_pipeline(df, [dedup(["A"])])
        assert len(result) == 2
        assert list(result["A"]) == [1, 2]

    def test_deduplicate_last(self):
        df = pd.DataFrame({"A": [1, 1, 2], "B": [3, 4, 4]})
        result = apply_refine_pipeline(df, [dedup(["A"], keep="last")])
        assert result.iloc[0]["B"] == 4  # last of the duplicates

    def test_deduplicate_missing_subset_raises(self, base_df):
        with pytest.raises(ValueError, match="subset required"):
            apply_refine_pipeline(base_df, [ColumnRefineAction(action="deduplicate", keep="first")])

    def test_complex_sequence_order(self, base_df):
        # 1. rename A -> ID
        # 2. drop C
        # 3. merge ID and B -> "ID_B" (since ID is now the new name)
        # 4. deduplicate on ID_B (no duplicates in this data, but should work)
        actions = [
            rename("A", "ID"),
            drop("C"),
            merge(["ID", "B"], target="ID_B", sep="_"),
            dedup(["ID_B"]),
        ]
        result = apply_refine_pipeline(base_df, actions)
        assert list(result.columns) == ["D", "ID_B"]
        # ID_B should contain e.g., "1_x"
        assert result.loc[0, "ID_B"] == "1_x"

    def test_invalid_dtype_conversion_raises(self, base_df):
    # converting string "B" to int should raise
        with pytest.raises(ValueError, match="cannot convert"):
            apply_refine_pipeline(base_df, [rename("B", "B", dtype="int")])