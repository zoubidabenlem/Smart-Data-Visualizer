// user-management.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { UserService } from 'src/app/core/services/user.service';
import { AssignDashboardsDialogComponent } from './assign-dashboards-dialog/assign-dashboards-dialog.component';
import { MatDialog } from '@angular/material/dialog';



@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  dashboards: any[] = [];            // all dashboards (for assignment)
  selectedDashboardMap: { [userId: number]: number | null } = {};

  private api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private dialog:   MatDialog,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadDashboards();
  }

  loadUsers(): void {
    this.http.get<any[]>(`${this.api}/users/`).subscribe(data => this.users = data);
  }

  loadDashboards(): void {
    // If your service already has a method to get all dashboards, use it.
    // Otherwise, call a generic endpoint. Example:
    this.http.get<any[]>(`${this.api}/dashboards?all=true`)   // you may need a backend route for this
      .subscribe(data => this.dashboards = data);
  }

  deleteUser(id: number): void {
    if (confirm('Delete user permanently?')) {
      this.http.delete(`${this.api}/users/${id}`).subscribe(() => this.loadUsers());
    }
  }

  toggleActive(user: any): void {
    const updated = { is_active: !user.is_active };
    this.http.put(`${this.api}/users/${user.id}`, updated).subscribe(() => this.loadUsers());
  }

    openAssignDialog(user: any): void {
    const dialogRef = this.dialog.open(AssignDashboardsDialogComponent, {
      width: '500px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        // Refresh the user list to reflect updated dashboard assignments
        this.loadUsers();
      }
    });
  }
}
