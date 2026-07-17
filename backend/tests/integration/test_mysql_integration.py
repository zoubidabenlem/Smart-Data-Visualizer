import pytest
from app.services.mysql_connection_service import MySQLConnectionService
from app.models.mysql_connection import MySQLConnection
from app.core.security import encrypt_password

class TestMySQLIntegration:

    def test_full_flow(self, client, auth_headers, db_session, source_db_setup):
        # 1. Create a connection to the source database
        conn_payload = {
            "name": "Test Source DB",
            "host": "localhost",
            "port": 3306,
            "database": "source_test",
            "username": "root",
            "password": "test_root_pass"
        }
        resp = client.post("/connections/mysql/", json=conn_payload, headers=auth_headers)
        assert resp.status_code == 200
        conn_data = resp.json()
        assert conn_data["name"] == "Test Source DB"
        conn_id = conn_data["id"]

        # 2. Test the connection
        resp = client.post(f"/connections/mysql/{conn_id}/test", headers=auth_headers)
        assert resp.json()["status"] == "ok"

        # 3. List tables – should see 'sales'
        resp = client.get(f"/connections/mysql/{conn_id}/tables", headers=auth_headers)
        assert "sales" in resp.json()["tables"]

        # 4. Get schema of 'sales'
        resp = client.get(f"/connections/mysql/{conn_id}/tables/sales/schema", headers=auth_headers)
        cols = resp.json()["columns"]
        col_names = [c["name"] for c in cols]
        assert "id" in col_names and "product" in col_names

        # 5. Preview data
        resp = client.get(f"/connections/mysql/{conn_id}/tables/sales/preview", headers=auth_headers)
        rows = resp.json()["rows"]
        assert len(rows) == 3

        # 6. Import as dataset
        import_payload = {"connection_id": conn_id, "table_name": "sales"}
        resp = client.post("/datasets/import", json=import_payload, headers=auth_headers)
        assert resp.status_code == 201  # dataset creation returns 201
        dataset = resp.json()
        dataset_id = dataset["id"]

        # 7. Preview the dataset
        resp = client.get(f"/datasets/{dataset_id}/preview", headers=auth_headers)
        assert len(resp.json()["data"]) > 0

        # 8. Prepare (aggregation)
        prepare_payload = {
            "filters": [],
            "group_by": ["product"],
            "agg_func": "sum",
            "value_col": "amount"
        }
        resp = client.post(f"/datasets/{dataset_id}/prepare", json=prepare_payload, headers=auth_headers)
        assert resp.status_code == 200
        chart_data = resp.json()["chart_data"]
        assert len(chart_data) == 2  # two products: Widget, Gadget

        # 9. Delete dataset
        resp = client.delete(f"/datasets/{dataset_id}", headers=auth_headers)
        assert resp.json()["message"]