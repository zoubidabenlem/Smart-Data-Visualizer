import pytest
from unittest.mock import patch, MagicMock
from app.services.dataset_loader import DatasetLoader
from app.models.dataset import Dataset, SourceType
import pandas as pd

@pytest.fixture
def mysql_dataset():
    ds = MagicMock(spec=Dataset)
    ds.id = 1
    ds.source_type = SourceType.mysql
    ds.connection_id = 1
    ds.source_table = "test_table"
    ds.source_path = None
    return ds

@pytest.fixture
def file_dataset_csv(tmp_path):
    # create a real temporary CSV file
    df = pd.DataFrame({"col1": [1,2], "col2": ["a","b"]})
    p = tmp_path / "test.csv"
    df.to_csv(p, index=False)
    ds = MagicMock(spec=Dataset)
    ds.id = 2
    ds.source_type = SourceType.csv
    ds.source_path = str(p)
    ds.connection_id = None
    ds.source_table = None
    return ds

def test_load_dataframe_mysql(mysql_dataset, db_session, mocker):
    mock_engine = MagicMock()
    mocker.patch("app.services.mysql_connection_service.MySQLConnectionService._build_engine", return_value=mock_engine)
    mocker.patch("pandas.read_sql_table", return_value=pd.DataFrame({"a": [1]}))
    
    # Need to mock the DB query to return a connection
    mocker.patch.object(db_session, "query", return_value=MagicMock(filter=MagicMock(first=MagicMock(return_value=MagicMock()))))
    
    df = DatasetLoader.load_dataframe(mysql_dataset, db_session)
    assert not df.empty
    assert list(df.columns) == ["a"]

def test_load_dataframe_csv(file_dataset_csv, db_session):
    df = DatasetLoader.load_dataframe(file_dataset_csv, db_session)
    assert df.shape == (2, 2)

def test_load_preview(mysql_dataset, db_session, mocker):
    mock_engine = MagicMock()
    mocker.patch("app.services.mysql_connection_service.MySQLConnectionService._build_engine", return_value=mock_engine)
    mocker.patch("pandas.read_sql_table", return_value=pd.DataFrame({"x": [1,2,3]}))
    mocker.patch.object(db_session, "query", return_value=MagicMock(filter=MagicMock(first=MagicMock(return_value=MagicMock()))))
    preview = DatasetLoader.load_preview(mysql_dataset, db_session, rows=2)
    assert len(preview) == 2