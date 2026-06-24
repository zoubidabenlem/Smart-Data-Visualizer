// src/app/core/services/dataset.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConfigureHeaderRequest, DatasetOut, DatasetPreview, RawPreviewResponse } from '../models/dataset.model';

@Injectable({
  providedIn: 'root'
})
export class DatasetService {
  private apiUrl = environment.apiUrl + '/datasets';

  constructor(private http: HttpClient) {}

  upload(file: File): Observable<DatasetOut> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DatasetOut>(`${this.apiUrl}/upload`, formData);
  }

  getDatasets(): Observable<DatasetOut[]> {
    return this.http.get<DatasetOut[]>(`${this.apiUrl}/`);
  }

  getDataset(id: number): Observable<DatasetOut> {
    return this.http.get<DatasetOut>(`${this.apiUrl}/${id}`);
  }

  deleteDataset(id:number):Observable<any>{
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getPreview(id: number): Observable<DatasetPreview> {
    return this.http.get<DatasetPreview>(`${this.apiUrl}/${id}/preview`);
  }

  //methods for schema refinement
  getDatasetColumns(datasetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${datasetId}/columns`);
  }

refineSchema(datasetId:number, payload:any): Observable<any> {
  return this.http.post(`${this.apiUrl}/${datasetId}/refine-schema`, payload);  
}

configureHeader(datasetId: number, config: ConfigureHeaderRequest): Observable<DatasetOut> {
  return this.http.post<DatasetOut>(`${this.apiUrl}/${datasetId}/configure-header`, config);
}

getRawPreview(datasetId: number, headerRow: number, skipRows: number[] = []): Observable<RawPreviewResponse> {
  let params = new HttpParams()
    .set('header_row', headerRow.toString())
    .set('skip_rows', skipRows.join(','));   // backend expects comma‑separated string
  return this.http.get<RawPreviewResponse>(`${this.apiUrl}/${datasetId}/raw-preview`, { params });
}
}

