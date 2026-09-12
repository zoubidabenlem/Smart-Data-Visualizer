import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, tap, throwError } from 'rxjs';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import {
  DashboardResponse,
  WidgetResponse,
  WidgetConfig,
  WidgetCreateRequest,
  WidgetUpdateRequest,
  WidgetPosition,
} from 'src/app/core/models/dashboard.model';
import { ModelDatasetOut } from 'src/app/core/models/data-model.model';

@Injectable({ providedIn: 'root' })
export class DashboardEditorService {
  private dashboardSubject = new BehaviorSubject<DashboardResponse | null>(null);
  public dashboard$ = this.dashboardSubject.asObservable();

  private selectedWidgetSubject = new BehaviorSubject<WidgetResponse | null>(null);
  public selectedWidget$ = this.selectedWidgetSubject.asObservable();

  private datasetsSubject = new BehaviorSubject<ModelDatasetOut[]>([]);
  public datasets$ = this.datasetsSubject.asObservable();

  private draftConfigSubject = new BehaviorSubject<WidgetConfig | null>(null);
  public draftConfig$ = this.draftConfigSubject.asObservable();

  // ─── NEW: event channel so the canvas can delegate widget creation ───
  private createWidgetRequestSubject = new Subject<void>();
  public createWidgetRequest$ = this.createWidgetRequestSubject.asObservable();

  constructor(private dashboardService: DashboardService) {}

  // ------------------------------------------------------------------
  // Dashboard state
  // ------------------------------------------------------------------

  setDashboard(dashboard: DashboardResponse): void {
    this.dashboardSubject.next(dashboard);
    if (!this.selectedWidgetSubject.value && dashboard.widgets.length > 0) {
      this.selectedWidgetSubject.next(dashboard.widgets[0]);
    }
  }

  private updateDashboardState(updatedDashboard: DashboardResponse): void {
    this.dashboardSubject.next(updatedDashboard);
  }

  setDatasets(datasets: ModelDatasetOut[]): void {
    this.datasetsSubject.next(datasets);
  }

  selectWidget(widgetId: number | null): void {
    const dashboard = this.dashboardSubject.value;
    if (!dashboard) return;
    const widget = widgetId
      ? dashboard.widgets.find(w => w.id === widgetId) || null
      : null;
    this.selectedWidgetSubject.next(widget);
  }

  setSelectedWidget(widget: WidgetResponse | null): void {
    this.selectedWidgetSubject.next(widget);
  }

  clearSelection(): void {
    this.selectedWidgetSubject.next(null);
  }

  // ------------------------------------------------------------------
  // Widget CRUD
  // ------------------------------------------------------------------

  addWidget(config: WidgetConfig, position?: WidgetPosition): Observable<WidgetResponse> {
    const dashboard = this.dashboardSubject.value;
    if (!dashboard) return throwError(() => new Error('Dashboard not loaded'));

    const request: WidgetCreateRequest = { config, position: position || null };

    return this.dashboardService.addWidget(dashboard.id, request).pipe(
      tap((res: any) => {
        // Backend returns a full WidgetResponse (see widget_crud.py fix).
        // Fall back to a composed object if it doesn't.
        const newWidget: WidgetResponse = {
          id: res.id,
          config: res.config ?? config,
          chart_data: res.chart_data ?? [],
          position: res.position ?? position ?? null,
        };
        this.updateDashboardState({
          ...dashboard,
          widgets: [...dashboard.widgets, newWidget],
        });
        this.selectedWidgetSubject.next(newWidget);
      })
    );
  }

  addWidgetLocally(widget: WidgetResponse): void {
    const dashboard = this.dashboardSubject.value;
    if (!dashboard) return;
    this.updateDashboardState({
      ...dashboard,
      widgets: [...dashboard.widgets, widget],
    });
    this.selectedWidgetSubject.next(widget);
  }

  updateWidget(widgetId: number, updates: Partial<WidgetUpdateRequest>): void {
    const dashboard = this.dashboardSubject.value;
    if (!dashboard) return;
    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return;

    this.dashboardService.updateWidget(dashboard.id, widgetId, updates).subscribe({
      next: (updatedWidget: WidgetResponse) => {
        const updatedWidgets = dashboard.widgets.map(w =>
          w.id === widgetId ? updatedWidget : w
        );
        this.updateDashboardState({ ...dashboard, widgets: updatedWidgets });
        if (this.selectedWidgetSubject.value?.id === widgetId) {
          this.selectedWidgetSubject.next(updatedWidget);
        }
      },
      error: (err) => console.error('Failed to update widget', err),
    });
  }

  deleteWidget(widgetId: number): void {
    const dashboard = this.dashboardSubject.value;
    if (!dashboard) return;
    this.dashboardService.deleteWidget(dashboard.id, widgetId).subscribe({
      next: () => {
        const updatedWidgets = dashboard.widgets.filter(w => w.id !== widgetId);
        this.updateDashboardState({ ...dashboard, widgets: updatedWidgets });
        if (this.selectedWidgetSubject.value?.id === widgetId) {
          this.selectedWidgetSubject.next(null);
        }
      },
      error: (err) => console.error('Failed to delete widget', err),
    });
  }

  updateWidgetPosition(widgetId: number, position: WidgetPosition): void {
    const dashboard = this.dashboardSubject.value;
    if (!dashboard) return;
    this.dashboardService.updateWidgetPosition(dashboard.id, widgetId, position).subscribe({
      next: (updatedWidget: WidgetResponse) => {
        const updatedWidgets = dashboard.widgets.map(w =>
          w.id === widgetId ? updatedWidget : w
        );
        this.updateDashboardState({ ...dashboard, widgets: updatedWidgets });
      },
      error: (err) => console.error('Failed to update widget position', err),
    });
  }

  // ------------------------------------------------------------------
  // Draft + local updates
  // ------------------------------------------------------------------

  setDraftConfig(config: WidgetConfig): void {
    this.draftConfigSubject.next(config);
  }

  /**
   * ─── FIX: accept a Partial<WidgetResponse> so chart_data survives ───
   */
  updateWidgetLocally(widgetId: number, changes: Partial<WidgetResponse>): void {
    const dashboard = this.dashboardSubject.value;
    if (!dashboard) return;

    const updatedWidgets = dashboard.widgets.map(w =>
      w.id === widgetId ? { ...w, ...changes } : w
    );
    this.updateDashboardState({ ...dashboard, widgets: updatedWidgets });

    const current = this.selectedWidgetSubject.value;
    if (current && current.id === widgetId) {
      this.selectedWidgetSubject.next({ ...current, ...changes });
    }
  }

  // ------------------------------------------------------------------
  // Misc
  // ------------------------------------------------------------------

  getDashboardId(): number | null {
    return this.dashboardSubject.value?.id ?? null;
  }

  getDashboard(): DashboardResponse | null {
    return this.dashboardSubject.value;
  }

  // ─── NEW: canvas asks the editor to run the real create flow ───
  requestCreateWidget(): void {
    this.createWidgetRequestSubject.next();
  }
}