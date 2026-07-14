// dashboard-viewer.component.ts
import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardEditorService } from '../../services/dashboard-editor.service';
import { GridsterComponent, GridsterConfig } from 'angular-gridster2';
import { GridsterService } from '../../services/gridster.service';
import { WidgetResponse } from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-dashboard-viewer',
  templateUrl: './dashboard-viewer.component.html',
  styleUrls: ['./dashboard-viewer.component.css']
})
export class DashboardViewerComponent implements OnInit {
  dashboardId!: number;
  dashboard$ = this.editorService.dashboard$;
  widgets$ = this.editorService.widgets$;
  isLoading = true;
  user = JSON.parse(localStorage.getItem('currentUser') || '{}') as { role: string } | null;

  @ViewChild(GridsterComponent) gridster!: GridsterComponent;

  // Read-only grid options (same grid dimensions as editor)
  viewerOptions: GridsterConfig = {
    gridType: 'scrollVertical',  // vertical scrolling
    displayGrid: 'none',           // no grid lines visible
    pushItems: false,

    draggable: { enabled: false },
    resizable: { enabled: false },
    minCols: 12,
    maxCols: 12,
    minRows: 6,
    maxRows: 100,
    fixedRowHeight: 120,           // adjust to your liking
    fixedColWidth: 105, 
    // no callbacks needed
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public gridService: GridsterService,
    private cdr: ChangeDetectorRef,

    private editorService: DashboardEditorService
  ) {}

  ngOnInit(): void {
    this.dashboardId = +this.route.snapshot.paramMap.get('id')!;
    this.editorService.loadDashboard(this.dashboardId).subscribe({
      next: () => {
        this.isLoading = false;
        this.syncGrid();
    },
      error: () => (this.isLoading = false)
    });
  }

  private syncGrid(): void {
    // Get current widgets from the service (same observable)
    this.widgets$.subscribe((widgets: WidgetResponse[] | null) => {
      if (widgets && widgets.length) {
        console.log('Widget Rows:', widgets.map(w => w.id + ': ' + (w.position?.['rows'] || 3)));
        console.log('Widget Positions:', widgets.map(w => w.position));
        console.log('Syncing widgets to Gridster:', widgets);
        // 🚨 VIEWER ONLY FIX: Clamp row height so they don't take up the whole screen
      const clampedWidgets = widgets.map(w => {
        if (w.position) {
          // Example: Force max rows to 4 for the viewer
          // Example: Force max rows to 4 for the viewer
          w.position['rows'] = Math.min(w.position['rows'] || 3, 4);
        }
        return w;});
        this.gridService.syncWidgets(clampedWidgets);
        this.cdr.detectChanges();  // ensure change detection runs
        // Force Gridster to recalc layout
        setTimeout(() => {
          if (this.gridster) {
            this.gridster.optionsChanged();
          }
        });
      }
    }).unsubscribe(); // immediate unsubscribe – we only need the first value
  }

  getWidgetIcon(chartType: string): string {
    return this.editorService.getWidgetIcon(chartType);
  }

  // Add this method to navigate back to the editor
  goBack(): void {
    this.router.navigate(['/dashboards', this.dashboardId, 'edit']);
  }

}
