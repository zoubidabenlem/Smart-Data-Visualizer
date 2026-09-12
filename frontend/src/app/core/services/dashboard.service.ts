// src/app/core/services/dashboard.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  DashboardCreateRequest,
  DashboardUpdateRequest,
  DashboardResponse,
  DashboardListItem,
  DashboardPaginatedResponse,
  WidgetCreateRequest,
  WidgetUpdateRequest,
  WidgetResponse,
  WidgetPosition,
  WidgetConfig,
  DashboardCreateResponse
} from '../models/dashboard.model';

// ─── FIX D: typed envelope for /models/{id}/prepare ───
export interface PrepareResponse {
  model_id: number;
  chart_data: any[];
  row_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private baseUrl = `${environment.apiUrl}/dashboards`;

  constructor(private http: HttpClient) {}

  // ------------------------------------------------------------------
  // Dashboard CRUD
  // ------------------------------------------------------------------

  listDashboards(page: number = 1, size: number = 10, search: string = ''): Observable<DashboardPaginatedResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<DashboardPaginatedResponse>(this.baseUrl, { params });
  }

  createDashboard(request: DashboardCreateRequest): Observable<DashboardCreateResponse> {
    return this.http.post<DashboardCreateResponse>(this.baseUrl, request);
  }

  getDashboard(dashboardId: number): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.baseUrl}/${dashboardId}`);
  }

  updateDashboard(dashboardId: number, request: DashboardUpdateRequest): Observable<DashboardResponse> {
    return this.http.put<DashboardResponse>(`${this.baseUrl}/${dashboardId}`, request);
  }

  deleteDashboard(dashboardId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${dashboardId}`);
  }

  // ------------------------------------------------------------------
  // Dashboard assignment
  // ------------------------------------------------------------------

  assignDashboardToUser(dashboardId: number, userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${dashboardId}/assign/${userId}`, {});
  }

  unassignDashboardFromUser(dashboardId: number, userId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${dashboardId}/unassign/${userId}`);
  }

  // ------------------------------------------------------------------
  // Widget operations
  // ------------------------------------------------------------------

  addWidget(dashboardId: number, request: WidgetCreateRequest): Observable<WidgetResponse> {
    return this.http.post<WidgetResponse>(`${this.baseUrl}/${dashboardId}/widgets`, request);
  }

  // ─── FIX D: return the typed envelope, not any[] ───
  getWidgetData(modelId: number, config: WidgetConfig): Observable<PrepareResponse> {
    return this.http.post<PrepareResponse>(
      `${environment.apiUrl}/models/${modelId}/prepare`,
      config
    );
  }

  updateWidget(
    dashboardId: number,
    widgetId: number,
    request: WidgetUpdateRequest
  ): Observable<WidgetResponse> {
    return this.http.put<WidgetResponse>(
      `${this.baseUrl}/${dashboardId}/widgets/${widgetId}`,
      request
    );
  }

  deleteWidget(dashboardId: number, widgetId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${dashboardId}/widgets/${widgetId}`);
  }

  updateWidgetPosition(
    dashboardId: number,
    widgetId: number,
    position: WidgetPosition
  ): Observable<WidgetResponse> {
    return this.http.patch<WidgetResponse>(
      `${this.baseUrl}/${dashboardId}/widgets/${widgetId}/position`,
      position
    );
  }
}