// src/app/core/services/dataset.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DatasetOut, DatasetPreview } from '../models/dataset.model';

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

  getPreview(id: number): Observable<DatasetPreview> {
    return this.http.get<DatasetPreview>(`${this.apiUrl}/${id}/preview`);
  }
}