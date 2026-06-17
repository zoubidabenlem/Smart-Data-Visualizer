import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { DashboardListItem } from 'src/app/core/models/dashboard.model';
import { UserService } from 'src/app/core/services/user.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-dashboard-list',
  templateUrl: './dashboard-list.component.html',
  styleUrls: ['./dashboard-list.component.css']
})
export class DashboardListComponent {
  isLoading = true;
  dashboards: DashboardListItem[] = [];
  

  constructor(private userService: UserService) {}

  ngOnInit(): void {
   
    console.log(this.userService.getUserAssignedDashboards)
    this.userService.listDashboards().subscribe({
      next: (data) => {
        this.dashboards = data;
        console.log(data);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
}
}