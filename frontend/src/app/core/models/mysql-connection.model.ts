// src/app/core/models/mysql-connection.model.ts

/** Single saved MySQL connection (as returned by backend) */
export interface MySQLConnection {
  id: number;
  user_id: number;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  created_at: string;        // ISO datetime string
}

/** Payload for creating a new connection */
export interface MySQLConnectionCreate {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/** Payload for updating an existing connection (all fields optional) */
export interface MySQLConnectionUpdate {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

/** Structure of a column in a MySQL table schema */
export interface MySQLTableColumn {
  name: string;
  dtype: string;             // e.g. "int", "varchar", "datetime"
}

/** Response from GET /connections/mysql/{id}/tables */
export interface TableListResponse {
  tables: string[];
}

/** Response from GET /connections/mysql/{id}/tables/{table}/schema */
export interface TableSchemaResponse {
  columns: MySQLTableColumn[];
}

/** Response from GET /connections/mysql/{id}/tables/{table}/preview */
export interface TablePreviewResponse {
  rows: Record<string, any>[];
}

/** Request body for POST /connections/mysql/import */
export interface ImportMySQLRequest {
  connection_id: number;
  table_name: string;
}