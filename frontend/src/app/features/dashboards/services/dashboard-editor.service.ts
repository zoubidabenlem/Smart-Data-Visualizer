// src/app/features/dashboards/services/dashboard-editor.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { DatasetService } from 'src/app/core/services/dataset.service';
import {
  DashboardResponse,
  WidgetResponse,
  WidgetCreateRequest,
  WidgetUpdateRequest,
  WidgetPosition,
} from 'src/app/core/models/dashboard.model';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { GridsterService } from './gridster.service';

export interface ColumnInfo {
  name: string;
  type: string;
}

@Injectable()
export class DashboardEditorService {
  private dashboardId: number | null = null;

  // State subjects
  private dashboardSubject = new BehaviorSubject<DashboardResponse | null>(null);
  private selectedDatasetIdSubject = new BehaviorSubject<number | null>(null);
  private columnsSubject = new BehaviorSubject<ColumnInfo[]>([]);
  private widgetsSubject = new BehaviorSubject<WidgetResponse[]>([]);

  // Public observables
  dashboard$ = this.dashboardSubject.asObservable();
  selectedDatasetId$ = this.selectedDatasetIdSubject.asObservable();
  columns$ = this.columnsSubject.asObservable();
  widgets$ = this.widgetsSubject.asObservable();

  // Convenience getter for current dashboard
  get currentDashboard(): DashboardResponse | null {
    return this.dashboardSubject.value;
  }

  constructor(
    private dashboardService: DashboardService,
    private datasetService: DatasetService,
    private http: HttpClient,
  ) {
    
  }

  /** Load dashboard by ID and optionally auto-select a dataset from query param */
  loadDashboard(id: number, initialDatasetId?: number | null): Observable<DashboardResponse> {
    this.dashboardId = id;
    return this.dashboardService.getDashboard(id).pipe(
      tap((dashboard) => {
        this.dashboardSubject.next(dashboard);
        this.widgetsSubject.next([...dashboard.widgets]);
        if (initialDatasetId) {
          this.selectDataset(initialDatasetId);
        }

      })
    );
  }

  /** Select a dataset and load its columns */
  selectDataset(datasetId: number | null): void {
    this.selectedDatasetIdSubject.next(datasetId);
    if (datasetId === null) {
      this.columnsSubject.next([]);
      return;
    }
    this.datasetService.getDatasetColumns(datasetId).subscribe({
      next: (response: any) => {
      // Extract columns array from the response object
      const cols = response?.columns || [];
      const mapped = cols.map((col: any) => ({
        name: col.name,
        type: col.dtype   // using "dtype" as shown in your example
      }));
      this.columnsSubject.next(mapped);
    },
    error: (err) => {
      console.error('Failed to load columns', err);
      this.columnsSubject.next([]);
    }
  });
}

  /** Update dashboard title */
  updateTitle(newTitle: string): Observable<void> {
    if (!this.dashboardId) throw new Error('Dashboard not loaded');
    return this.dashboardService.updateDashboard(this.dashboardId, { title: newTitle }).pipe(
      tap(() => {
        const current = this.dashboardSubject.value;
        if (current) {
          this.dashboardSubject.next({ ...current, title: newTitle });
        }
      })
    );
  }

  /** Delete a widget and refresh the list */
  deleteWidget(widgetId: number): Observable<void> {
    if (!this.dashboardId) throw new Error('Dashboard not loaded');
    return this.dashboardService.deleteWidget(this.dashboardId, widgetId).pipe(
      switchMap(() => this.refreshDashboard())
    );
  }

  /** Refresh the dashboard data (e.g., after add/edit) */
 refreshDashboard(): Observable<void> {
    if (!this.dashboardId) throw new Error('Dashboard not loaded');
    return this.dashboardService.getDashboard(this.dashboardId).pipe(
      tap((dashboard) => {
        this.dashboardSubject.next(dashboard);
        this.widgetsSubject.next([...dashboard.widgets]);
      }),
      map(() => void 0)
    );
  }

  /** Helper to get icon name for chart type */
  getWidgetIcon(chartType: string): string {
    const icons: Record<string, string> = {
      bar: 'bar_chart',
      line: 'show_chart',
      pie: 'pie_chart',
      scatter: 'scatter_plot',
      area: 'area_chart',
      heatmap: 'grid_on',
      kpi: 'numbers',
    };
    return icons[chartType] || 'insight';
  }
  private readonly baseUrl = `${environment.apiUrl}/dashboards`; 

  updateWidgetPosition(widgetId: number, position: WidgetPosition): Observable<any> {
  return this.http.patch(
    `${this.baseUrl}/${this.dashboardId}/widgets/${widgetId}/position`,
    position   // <-- send directly, no wrapping
  );
}

}