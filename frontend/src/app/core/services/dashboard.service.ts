import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Import all generated types from your JSON schema conversion
import {
  DashboardCreateRequest,
  DashboardListItem,
  DashboardResponse,
  WidgetCreateRequest,
  WidgetUpdateRequest,
  WidgetResponse,
  DashboardUpdateRequest,
} from '../models/dashboard.model';
import { environment } from 'src/environments/environment';
@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly baseUrl = `${environment.apiUrl}/dashboards`; 
  constructor(private http: HttpClient) { }

  //----- Dashboard API methods -----

  // ---------- Dashboard CRUD ----------
  createDashboard(payload: DashboardCreateRequest): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(this.baseUrl, payload);
  }

  listDashboards(): Observable<DashboardListItem[]> {
    return this.http.get<DashboardListItem[]>(this.baseUrl);
  }

  getDashboard(id: number): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.baseUrl}/${id}`);
  }

  updateDashboard(id: number, payload: DashboardUpdateRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, payload);
  }

  deleteDashboard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  
  // ---------- Widget CRUD ----------
  addWidget(dashboardId: number, payload: WidgetCreateRequest): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.baseUrl}/${dashboardId}/widgets`, payload);
  }

  updateWidget(
    dashboardId: number,
    widgetId: number,
    payload: WidgetUpdateRequest
  ): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${dashboardId}/widgets/${widgetId}`, payload);
  }

  deleteWidget(dashboardId: number, widgetId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${dashboardId}/widgets/${widgetId}`);
  }
 

}
