import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { DashboardResponse, WidgetResponse, ChartType } from 'src/app/core/models/dashboard.model';
import { DashboardService } from 'src/app/core/services/dashboard.service';

@Component({
  selector: 'app-dashboard-viewer',
  templateUrl: './dashboard-viewer.component.html',
  styleUrls: ['./dashboard-viewer.component.css']
})
export class DashboardViewerComponent implements OnInit {
  private dashboardSubject = new BehaviorSubject<DashboardResponse | null>(null);
  dashboard$ = this.dashboardSubject.asObservable();
  widgets$: Observable<WidgetResponse[]> = new Observable();

  constructor(
    private route: ActivatedRoute,
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.dashboardService.getDashboard(id).subscribe({
      next: (dashboard) => {
        this.dashboardSubject.next(dashboard);
        this.widgets$ = new BehaviorSubject(dashboard.widgets).asObservable();
      },
      error: (err) => console.error('Failed to load dashboard', err)
    });
  }

  getWidgetIcon(chartType: ChartType): string {
    // Return an appropriate icon name (Material icon) based on chart type
    const icons: Record<ChartType, string> = {
      bar: 'bar_chart',
      line: 'show_chart',
      pie: 'pie_chart',
      scatter: 'scatter_plot',
      area: 'area_chart',
      heatmap: 'grid_on',
      kpi: 'speed'
    };
    return icons[chartType] || 'insert_chart';
  }
}