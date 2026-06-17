// src/app/core/services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, Observable, of } from 'rxjs';
import { DashboardListItem } from '../models/dashboard.model';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {

  constructor(private http: HttpClient) {}
private readonly api = `${environment.apiUrl}`;

 // ----- Assignment methods -----
  assignDashboardToUser(dashboardId: number, userId: number): Observable<void> {
    return this.http.post<void>(
      `${this.api}/dashboards/${dashboardId}/assign/${userId}`, {}
    );
  }

  unassignDashboardFromUser(dashboardId: number, userId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.api}/dashboards/${dashboardId}/unassign/${userId}`
    );
  }

  getUserAssignedDashboards(userId: number): Observable<DashboardListItem[]> {
    return this.http.get<DashboardListItem[]>(
      `${this.api}/users/${userId}/assigned-dashboards`
    );
  }

  // Optional: if you really need a method to get all dashboards here,
  // but it should be in DashboardService. Remove it if not needed.
  listDashboards(): Observable<DashboardListItem[]> {
    return this.http.get<DashboardListItem[]>(`http://localhost:8000/dashboards`);
  }
  /**
 * Fetch the currently authenticated user's full profile.
 * Backend identifies the user via the JWT in the Authorization header.
 */
  getCurrentUser(): Observable<User | null> {
  return this.http.get<User>(`${this.api}/users/me`).pipe(
    catchError(err => {
      console.error('Failed to load current user profile', err);
      return of(null);
    })
  );
}
}