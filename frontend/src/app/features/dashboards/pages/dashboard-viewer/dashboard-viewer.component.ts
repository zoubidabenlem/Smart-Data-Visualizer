// dashboard-viewer.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardEditorService } from '../../services/dashboard-editor.service';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private editorService: DashboardEditorService
  ) {}

  ngOnInit(): void {
    this.dashboardId = +this.route.snapshot.paramMap.get('id')!;
    this.editorService.loadDashboard(this.dashboardId).subscribe({
      next: () => (this.isLoading = false),
      error: () => (this.isLoading = false)
    });
  }

  getWidgetIcon(chartType: string): string {
    return this.editorService.getWidgetIcon(chartType);
  }

  // Add this method to navigate back to the editor
  goBack(): void {
    this.router.navigate(['/dashboards', this.dashboardId, 'edit']);
  }
}