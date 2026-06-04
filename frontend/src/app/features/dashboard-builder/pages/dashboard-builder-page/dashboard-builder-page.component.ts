import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DashboardBuilderService, BuilderWidget } from 'src/app/core/services/dashboard-builder.service';
import { ChartType, WidgetConfig } from 'src/app/core/models/dashboard.model';
import { DatasetService } from 'src/app/core/services/dataset.service'; // adjust path
@Component({
  selector: 'app-dashboard-builder-page',
  templateUrl: './dashboard-builder-page.component.html',
  styleUrls: ['./dashboard-builder-page.component.css']
})
export class DashboardBuilderPageComponent implements OnInit, OnDestroy {
  title = '';
  widgets: BuilderWidget[] = [];
  activeWidget: BuilderWidget | null = null;
  datasetColumns: string[] = [];
  isSaving = false;
  isLoading = true;
  error = '';
  private destroy$ = new Subject<void>();

  constructor(
    public builderService: DashboardBuilderService,
    private route: ActivatedRoute,
    public router: Router,
    private datasetService: DatasetService,
    private snackBar: MatSnackBar,
    private dashboardService: DashboardBuilderService
  ) {}

  ngOnInit(): void {
      console.log('DashboardBuilderPageComponent initialized');

    // Subscribe to builder state
    this.builderService.getState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.title = state.title;
        this.widgets = state.widgets;
        this.activeWidget = state.widgets.find(w => w.id === state.activeWidgetId) || null;
        this.datasetColumns = state.datasetColumns;
        if (state.datasetId && !this.isLoading) {
          // once dataset is loaded, we can allow adding widgets
          this.isLoading = false;
        }
      });

    // Read datasetId from query param
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const datasetId = params['datasetId'];
      if (datasetId) {
        this.loadDataset(Number(datasetId));
      } else {
        this.error = 'No dataset selected. Please go back and choose a dataset.';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

 private loadDataset(datasetId: number): void {
  this.isLoading = true;
  this.datasetService.getDatasetColumns(datasetId).subscribe({
    next: (response: any) => {
      // Extract columns array from response (adjust based on actual backend)
      let columnsArray = response?.columns || response;
      
      // If it's not an array, try to see if response itself is the array
      if (!Array.isArray(columnsArray)) {
        console.error('Columns response is not an array:', response);
        this.error = 'Invalid columns response from server.';
        this.isLoading = false;
        return;
      }

      // Map to column names – handles both { name: ... } objects or plain strings
      const columnNames = columnsArray.map((col: any) => 
        typeof col === 'string' ? col : col.name
      );

      if (columnNames.length === 0) {
        this.error = 'No columns found in dataset.';
        this.isLoading = false;
        return;
      }

      this.builderService.initDashboard(datasetId, columnNames);
      this.isLoading = false;
    },
    error: (err) => {
      console.error(err);
      this.error = 'Failed to load dataset columns.';
      this.isLoading = false;
    }
  });
}

  // Widget actions
  addWidget(type: ChartType): void {
    this.builderService.addWidget(type);
  }

  removeWidget(widgetId: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Remove this widget?')) {
      this.builderService.removeWidget(widgetId);
    }
  }

  setActiveWidget(widgetId: string): void {
    this.builderService.setActiveWidget(widgetId);
  }

  updateActiveWidget(patch: Partial<WidgetConfig>): void {
    if (this.activeWidget) {
      this.builderService.updateWidget(this.activeWidget.id, patch);
    }
  }

  // Save dashboard
  async saveDashboard(): Promise<void> {
    const charts = this.widgets.filter(w => w.chart_type !== 'kpi');
    const kpis = this.widgets.filter(w => w.chart_type === 'kpi');
    if (charts.length < 3 || kpis.length < 1) {
      this.snackBar.open(
        `Need at least 3 charts (${charts.length}) and 1 KPI (${kpis.length})`,
        'Close', { duration: 5000 }
      );
      return;
    }
    if (!this.title.trim()) {
      this.snackBar.open('Dashboard title required', 'Close', { duration: 3000 });
      return;
    }
    this.isSaving = true;
    try {
      const payload = this.builderService.serializeForSave();
      // Call POST /dashboards/ (your backend expects { title, widgets })
      const response = await this.dashboardService.create(payload).toPromise();
      console.log('Save payload:', payload);
      await new Promise(r => setTimeout(r, 1000)); // simulate
      this.snackBar.open('Dashboard saved!', 'Close', { duration: 3000 });
      // Optionally navigate to dashboard list
    } catch (err) {
      this.snackBar.open('Error saving dashboard', 'Close', { duration: 3000 });
    } finally {
      this.isSaving = false;
    }
  }

  // Helper for icons
  getWidgetIcon(type: string): string {
    const icons: Record<string, string> = {
      bar: 'bar_chart',
      line: 'show_chart',
      pie: 'pie_chart',
      scatter: 'scatter_plot',
      area: 'area_chart',
      heatmap: 'grid_on',
      kpi: 'numbers'
    };
    return icons[type] || 'insert_chart';
  }

  chartTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter', 'area', 'heatmap'];
  allChartTypes: ChartType[] = [...this.chartTypes, 'kpi'];
}