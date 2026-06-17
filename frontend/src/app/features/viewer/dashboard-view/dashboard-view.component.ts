import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { DashboardResponse } from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-dashboard-view',
  templateUrl: './dashboard-view.component.html',
  styleUrls: ['./dashboard-view.component.css']
})
export class DashboardViewComponent implements OnInit {
  dashboard: DashboardResponse | null = null;

  constructor(
    private route: ActivatedRoute,
    private dashboardService: DashboardService
  ) {}

  ngOnInit() {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.dashboardService.getDashboard(id).subscribe({
      next: (dash) => {
        this.dashboard = dash;
        console.log('Dashboard loaded:', this.dashboard);
        console.log('Widgets:', this.dashboard?.widgets);
      },
      error: (err) => {
        console.error('Failed to load dashboard', err);
      }
    });
  }

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
}