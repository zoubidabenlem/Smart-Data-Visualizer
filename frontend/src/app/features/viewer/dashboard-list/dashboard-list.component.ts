import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { DashboardListItem } from 'src/app/core/models/dashboard.model';
import { DashboardService } from 'src/app/core/services/dashboard.service';

@Component({
  selector: 'app-dashboard-list',
  templateUrl: './dashboard-list.component.html',
  styleUrls: ['./dashboard-list.component.css']
})
export class DashboardListComponent {
  isLoading = true;
  dashboards: DashboardListItem[] = [];
  

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
   // size=10000 – viewer will only see their own dashboards because of backend logic
    this.dashboardService.listDashboards('', 1, 10000).subscribe({
      next: (res) => {
        this.dashboards = res.items;   // ✅ plain array
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
}
}