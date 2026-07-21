// src/app/core/services/mysql-connection.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MySQLConnection,
  MySQLConnectionCreate,
  MySQLConnectionUpdate,
  TableListResponse,
  TableSchemaResponse,
  TablePreviewResponse,
  ImportMySQLRequest
} from '../models/mysql-connection.model';
import { DatasetOut } from '../models/dataset.model';

@Injectable({ providedIn: 'root' })   // available everywhere, no need to register in providers
export class MySQLConnectionService {
  private baseUrl = `${environment.apiUrl}/connections/mysql`;

  constructor(private http: HttpClient) {}

  // ---------- Connection CRUD ----------
  create(payload: MySQLConnectionCreate): Observable<MySQLConnection> {
    return this.http.post<MySQLConnection>(this.baseUrl, payload);
  }

  list(): Observable<MySQLConnection[]> {
    return this.http.get<MySQLConnection[]>(this.baseUrl);
  }

  get(id: number): Observable<MySQLConnection> {
    return this.http.get<MySQLConnection>(`${this.baseUrl}/${id}`);
  }

  update(id: number, payload: MySQLConnectionUpdate): Observable<MySQLConnection> {
    return this.http.put<MySQLConnection>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  // ---------- Testing & exploration ----------
  testConnection(id: number): Observable<any> {
    // Backend returns { status: 'ok', ... } or a message
    return this.http.post(`${this.baseUrl}/${id}/test`, {});
  }

  listTables(connectionId: number): Observable<TableListResponse> {
    return this.http.get<TableListResponse>(`${this.baseUrl}/${connectionId}/tables`);
  }

  getTableSchema(connectionId: number, tableName: string): Observable<TableSchemaResponse> {
    return this.http.get<TableSchemaResponse>(
      `${this.baseUrl}/${connectionId}/tables/${encodeURIComponent(tableName)}/schema`
    );
  }

  getTablePreview(connectionId: number, tableName: string): Observable<TablePreviewResponse> {
    return this.http.get<TablePreviewResponse>(
      `${this.baseUrl}/${connectionId}/tables/${encodeURIComponent(tableName)}/preview`
    );
  }

  // ---------- Import as dataset ----------
  importTable(request: ImportMySQLRequest): Observable<DatasetOut> {
    return this.http.post<DatasetOut>(`${this.baseUrl}/import`, request);
  }
}