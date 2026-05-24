/**
  * endponts for CRUD operations on dashboards
  */
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import {
  DashboardConfig,
  DashboardResponse,
  DashboardListItem,
} from '../models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private baseUrl = '/api/dashboards';

  constructor(private http: HttpClient) {}

  create(config: DashboardConfig): Observable< {id: number} > {
    return this.http.post< {id: number} >(this.baseUrl, {config});
  }

  get(id: number): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.baseUrl}/${id}`);
  }

  list(): Observable<DashboardListItem[]> {
    return this.http.get<DashboardListItem[]>(this.baseUrl);
  }

  update(id: number, payload: { title?: string; config?: DashboardConfig }): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  private handleError(error: HttpErrorResponse) {
    //let the builder service process 422 errors,
    return throwError(() => error);
  }
}