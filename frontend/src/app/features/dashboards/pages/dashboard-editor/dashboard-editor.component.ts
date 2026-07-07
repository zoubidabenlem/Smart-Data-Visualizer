// src/app/features/dashboards/pages/dashboard-editor/dashboard-editor.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DashboardEditorService } from '../../services/dashboard-editor.service';
import { DatasetService } from 'src/app/core/services/dataset.service';

import { HeaderTitleService } from 'src/app/core/services/header-title.service';
import { WidgetResponse } from 'src/app/core/models/dashboard.model';
import { DatasetOut } from 'src/app/core/models/dataset.model';
import { WidgetConfigDialogComponent } from '../../components/widget-config-dialog/widget-config-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { GridsterService } from '../../services/gridster.service';
import { WidgetPopupComponent } from '../../components/widget-popup/widget-popup.component';

@Component({
  selector: 'app-dashboard-editor',
  templateUrl: './dashboard-editor.component.html',
  styleUrls: ['./dashboard-editor.component.css'],
})
export class DashboardEditorComponent implements OnInit, OnDestroy {
  dashboardId!: number;
  isLoading = true;
  // Inside your dashboard-editor.component.ts class
public isLeftPaneCollapsed = false;
  // Title editing
  editingTitle = false;
  newTitle = '';

  // Datasets (from your existing DatasetService)
  datasets: DatasetOut[] = [];

  // State from editor service
  dashboard$ = this.editorService.dashboard$.pipe(
    tap(val => console.log('[DEBUG] dashboard$:', val))
  );
  widgets$ = this.editorService.widgets$.pipe(
    tap(val => console.log('[DEBUG] widgets$:', val))
  );
  selectedDatasetId$ = this.editorService.selectedDatasetId$.pipe(
    tap(val => console.log('[DEBUG] selectedDatasetId$:', val))
  );
  
  columns$ = this.editorService.columns$.pipe(
    tap(val => console.log('[DEBUG] columns$:', val))
  );

  // For local drag-drop (we'll keep it simple – static list for now)
  draggedWidgets: WidgetResponse[] = [];

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private editorService: DashboardEditorService,
    private datasetService: DatasetService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private headerTitle: HeaderTitleService,
    public gridService : GridsterService
  ) {}

  ngOnInit(): void {
    this.dashboardId = +this.route.snapshot.paramMap.get('id')!;
    const queryDatasetId = this.route.snapshot.queryParamMap.get('dataset_id');
    const initialDatasetId = queryDatasetId ? +queryDatasetId : null;

    console.log('[DEBUG] Dashboard ID:', this.dashboardId);
    console.log('[DEBUG] Initial Dataset ID from query params:', initialDatasetId);

    // Load dashboard data with optional dataset pre-selection
    this.editorService.loadDashboard(this.dashboardId, initialDatasetId).subscribe({
      next: () => {
        console.log('[DEBUG] Dashboard loaded successfully');
        this.headerTitle.setTitle(`Dashboard: ${this.editorService.currentDashboard?.id || ''}`);

        this.isLoading = false;
      },
      error: (err) => {
        console.error('[DEBUG] Dashboard load error:', err);
        this.snackBar.open('Dashboard not found', 'Close', { duration: 3000 });
        this.router.navigate(['/dashboards']);
      },
    });
    

    // Load datasets list for the dropdown
    console.log('[DEBUG] Fetching datasets list...');
    this.datasetService.getDatasets().subscribe({
      next: (data) => {
        console.log('[DEBUG] Datasets fetched:', data);
        this.datasets = data;
      },
      error: (err) => console.error('[DEBUG] Failed to load datasets:', err),
    });

    // Sync local draggedWidgets with service widgets (for drag-drop later)
    this.subs.push(
      this.widgets$.subscribe((widgets) => {
        console.log('[DEBUG] Widgets updated:', widgets);
        if (widgets) this.draggedWidgets = [...widgets];
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ----- Title editing -----
  startEditTitle(): void {
    this.newTitle = this.editorService.currentDashboard?.title || '';
    this.editingTitle = true;
  }

  saveTitle(): void {
    if (!this.newTitle.trim()) return;
    this.editorService.updateTitle(this.newTitle.trim()).subscribe({
      next: () => {
        this.snackBar.open('Title updated', 'Close', { duration: 1500 });
        this.editingTitle = false;
      },
      error: () => {
        this.snackBar.open('Failed to update title', 'Close', { duration: 3000 });
      },
    });
  }

  // ----- Dataset selection -----
  onDatasetChange(datasetId: number): void {
    console.log('[DEBUG] Dataset change triggered with ID:', datasetId);
    this.editorService.selectDataset(datasetId);
  }

  // ----- Widget actions Task 4 will implement) -----
 addChart(): void {
  this.openWidgetDialog(undefined, 'chart');
}

addKpi(): void {
  this.openWidgetDialog(undefined, 'kpi');
}

editWidget(widget: WidgetResponse): void {
  this.openWidgetDialog(widget);
}

private openWidgetDialog(widget?: WidgetResponse, defaultType?: 'chart' | 'kpi'): void {
  // Use a snapshot tracker if available, or fetch it dynamically
  let datasetIdSnapshot: number | null = null;
  
  // Take the snapshot value synchronously from the public observable stream
  this.selectedDatasetId$.subscribe(id => datasetIdSnapshot = id).unsubscribe();
console.log('[DEBUG] Opening widget dialog with dataset ID snapshot:', datasetIdSnapshot);
  const dialogRef = this.dialog.open(WidgetConfigDialogComponent, {
    width: '800px',
    data: {
      dashboardId: this.dashboardId,
      widget: widget,
      preSelectedDatasetId: datasetIdSnapshot, //  Fixed using public state stream
      defaultChartType: defaultType
    }
  });
  dialogRef.afterClosed().subscribe((result: boolean) => {
    if (result === true) {
      // Refresh dashboard data
      this.editorService.refreshDashboard().subscribe();
    }
  });
}

  deleteWidget(widgetId: number, event: Event): void {
    event.stopPropagation();
    if (confirm('Delete this widget?')) {
      this.editorService.deleteWidget(widgetId).subscribe({
        next: () => this.snackBar.open('Widget deleted', 'Close', { duration: 1500 }),
        error: () => this.snackBar.open('Failed to delete widget', 'Close', { duration: 3000 }),
      });
    }
  }

  // Helper to get icon from service
  getWidgetIcon(chartType: string): string {
    return this.editorService.getWidgetIcon(chartType);
  }
  
  openPopup(widget: WidgetResponse): void {
  this.dialog.open(WidgetPopupComponent, {
    data: { widget },
    width: 'auto',
    height: 'auto',
    maxWidth: '90vw',
    maxHeight: '90vh',
    panelClass: 'enlarged-chart-dialog',
    disableClose: false,
    autoFocus: false
  });
}
  saveDashboard(): void {
    // Optional: show confirmation or auto-save any pending changes
    
    this.snackBar.open('Saving dashboard & opening viewer...', 'Close', { duration: 2000 });
    this.editorService.refreshDashboard().subscribe(() => {
    this.router.navigate(['/dashboards', 'view', this.dashboardId]);
  });

  }
  

}