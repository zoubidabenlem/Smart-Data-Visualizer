// src/app/core/services/dataset.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, debounceTime, distinctUntilChanged, Observable, Subject, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConfigureHeaderRequest, DatasetOut, DatasetPreview, PaginationInfo, RawPreviewResponse } from '../models/dataset.model';
import { PaginatedResponse } from '../models/dataset.model';

@Injectable({
  providedIn: 'root'
})
export class DatasetService {
  private apiUrl = environment.apiUrl + '/datasets';

  // Internal state
  private searchTerm = '';
  private currentPage = 1;
  private pageSize = 10;

  // Subjects for pagination and loading
  private datasetsSubject = new BehaviorSubject<DatasetOut[]>([]);
  private paginationSubject = new BehaviorSubject<PaginationInfo>({
    page: 1, size: 10, total: 0, pages: 0
  });
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string>('');

  // Public observables – components subscribe to these
  datasets$: Observable<DatasetOut[]> = this.datasetsSubject.asObservable();
  pagination$: Observable<PaginationInfo> = this.paginationSubject.asObservable();
  loading$: Observable<boolean> = this.loadingSubject.asObservable();
  error$: Observable<string> = this.errorSubject.asObservable();

  // Search subject with debounce
  private searchInput$ = new Subject<string>();

  constructor(private http: HttpClient) {
     // Whenever search input changes (debounced), reset page and fetch
    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(term => {
        this.searchTerm = term;
        this.currentPage = 1;
      }),
      switchMap(() => this.fetchFromApi())
    ).subscribe();

    // Initial load
    this.fetchFromApi().subscribe();

  }

  upload(file: File): Observable<DatasetOut> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DatasetOut>(`${this.apiUrl}/upload`, formData);
  }

  getDatasets(search = '', page = 1, size = 10): Observable<PaginatedResponse> {
  const params = new HttpParams()
    .set('search', search)
    .set('page', page.toString())
    .set('size', size.toString());
  return this.http.get<PaginatedResponse>(`${this.apiUrl}`, { params });
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
 // Called by components to change search
  setSearch(term: string) {
    this.searchInput$.next(term);
  }

  // Called by components for pagination
  goToPage(page: number) {
    if (page < 1 || page > this.paginationSubject.value.pages) return;
    this.currentPage = page;
    this.fetchFromApi().subscribe();
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

 // Core HTTP request – returns Observable so we can chain / subscribe
  private fetchFromApi(): Observable<PaginatedResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next('');

    const params = new HttpParams()
      .set('search', this.searchTerm)
      .set('page', this.currentPage.toString())
      .set('size', this.pageSize.toString());

    return this.http.get<PaginatedResponse>(this.apiUrl, { params }).pipe(
      tap({
        next: (res) => {
          this.datasetsSubject.next(res.items);
          this.paginationSubject.next({
            page: res.page,
            size: res.size,
            total: res.total,
            pages: res.pages,
          });
          this.loadingSubject.next(false);
        },
        error: (err) => {
          this.errorSubject.next('Failed to load datasets');
          this.loadingSubject.next(false);
        }
      })
    );
  }

  // Convenience method to trigger a refresh (e.g., after delete/upload)
  refresh() {
    this.fetchFromApi().subscribe();
  }
}

