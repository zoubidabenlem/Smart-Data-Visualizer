// src/app/core/services/survey.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface SurveyRequest {
  id: number;
  business_email: string;
  contact_name?: string;
  company_name?: string;
  data_description: string;
  status: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class SurveyService {
  private api = `${environment.apiUrl}/survey`;

  constructor(private http: HttpClient) {}

  submitSurvey(payload: any): Observable<any> {
    return this.http.post(`${this.api}/submit`, payload);
  }

  // Admin only
  getAllRequests(): Observable<SurveyRequest[]> {
    return this.http.get<SurveyRequest[]>(`${this.api}/requests`);
  }

  updateRequestStatus(id: number, status: string): Observable<SurveyRequest> {
    return this.http.patch<SurveyRequest>(`${this.api}/requests/${id}/status`, { status });
}
}