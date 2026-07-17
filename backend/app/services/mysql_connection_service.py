import pandas as pd
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from typing import List, Dict, Optional
from fastapi import HTTPException, status
from app.models.mysql_connection import MySQLConnection
from app.models.dataset import Dataset, SourceType
from app.core.security import decrypt_password
from app.core.logging_config import logger

class MySQLConnectionService:

    @staticmethod
    def _build_engine(connection: MySQLConnection) -> Engine:
        """Create a SQLAlchemy engine from a connection record."""
        password = decrypt_password(connection.encrypted_password)
        url = f"mysql+pymysql://{connection.username}:{password}@{connection.host}:{connection.port}/{connection.database}"
        return create_engine(url, connect_args={"connect_timeout": 10})

    @staticmethod
    def test_connection(connection: MySQLConnection) -> Dict[str, str]:
        """Test if connection parameters are valid."""
        try:
            engine = MySQLConnectionService._build_engine(connection)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return {"status": "ok"}
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")

    @staticmethod
    def list_tables(connection: MySQLConnection) -> List[str]:
        """List all tables and views in the connected database."""
        engine = MySQLConnectionService._build_engine(connection)
        try:
            inspector = inspect(engine)
            tables = inspector.get_table_names() + inspector.get_view_names()
            return sorted(tables)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not list tables: {str(e)}")

    @staticmethod
    def get_table_schema(connection: MySQLConnection, table_name: str) -> List[dict]:
        """Return column names and frontend-friendly types for a table."""
        engine = MySQLConnectionService._build_engine(connection)
        try:
            inspector = inspect(engine)
            columns = inspector.get_columns(table_name)
            schema = []
            for col in columns:
                dtype = str(col["type"]).lower()
                if "int" in dtype or "float" in dtype or "decimal" in dtype:
                    frontend_type = "number"
                elif "datetime" in dtype or "date" in dtype:
                    frontend_type = "date"
                else:
                    frontend_type = "text"
                schema.append({"name": col["name"], "dtype": frontend_type})
            return schema
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read schema: {str(e)}")

    @staticmethod
    def get_row_count(connection: MySQLConnection, table_name: str) -> int:
        """Return approximate row count of a table."""
        engine = MySQLConnectionService._build_engine(connection)
        try:
            with engine.connect() as conn:
                result = conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}`"))
                return result.scalar()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not count rows: {str(e)}")

    @staticmethod
    def get_preview(connection: MySQLConnection, table_name: str, limit: int = 50) -> List[dict]:
        """Fetch first N rows of a table as a list of dicts."""
        engine = MySQLConnectionService._build_engine(connection)
        try:
            df = pd.read_sql_table(table_name, engine, index_col=None, chunksize=limit)
            chunk = next(df)
            # Clean data for JSON serialisation
            from app.services.pipeline.utils import dataframe_to_json_safe, sanitize_records
            safe_data = dataframe_to_json_safe(chunk)
            safe_data = sanitize_records(safe_data)
            return safe_data
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not preview table: {str(e)}")

    @staticmethod
    def import_dataset(
        connection: MySQLConnection,
        table_name: str,
        current_user_id: int,
        db_session
    ) -> Dataset:
        """
        Import a MySQL table as a new dataset.
        Returns the created Dataset object.
        """
        # Extract metadata
        schema = MySQLConnectionService.get_table_schema(connection, table_name)
        row_count = MySQLConnectionService.get_row_count(connection, table_name)
        col_count = len(schema)

        dataset = Dataset(
            user_id=current_user_id,
            filename=table_name,                        # use table name as filename
            source_type=SourceType.mysql,
            source_path=None,                           # not used for MySQL
            connection_id=connection.id,
            source_table=table_name,
            row_count=row_count,
            col_count=col_count,
            column_schema=schema,
            header_row=0,
            skip_rows=None,
            custom_column_names=None,
            is_refined=False,
            refined_column_schema=None,
        )
        db_session.add(dataset)
        db_session.commit()
        db_session.refresh(dataset)
        logger.info(f"Imported MySQL table '{table_name}' as dataset {dataset.id}")
        return dataset