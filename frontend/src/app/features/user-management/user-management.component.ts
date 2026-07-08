import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { UserService } from 'src/app/core/services/user.service';
import { AssignDashboardsDialogComponent } from './assign-dashboards-dialog/assign-dashboards-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { SurveyService, SurveyRequest } from 'src/app/core/services/survey.service';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  // ── Users data ────────────────────────────────────────────────────
  allUsers: any[] = [];
  usersPage: any[] = [];
  userPageIndex = 0;
  userPageSize = 5;

  // ── Filters ──────────────────────────────────────────────────────
  // null = show all, true = active only, false = inactive only
  filterActive: boolean | null = null;

  // ── Dashboards (for assignment dialog) ────────────────────────────
  dashboards: any[] = [];

  // ── Survey requests data ─────────────────────────────────────────
  allRequests: SurveyRequest[] = [];
  requestsPage: SurveyRequest[] = [];
  requestPageIndex = 0;
  requestPageSize = 5;

  // ── Filter for survey status ─────────────────────────────────────
  filterSurveyStatus: string | null = null; // 'pending', 'reviewed', or null for all

  private api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private userService: UserService,
    private surveyService: SurveyService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadDashboards();
    this.loadSurveyRequests();
  }

  // ── Load all users ──────────────────────────────────────────────
  loadUsers(): void {
    this.http.get<any[]>(`${this.api}/users/`).subscribe(data => {
      this.allUsers = data;
      console.log('Loaded users:', this.allUsers);
      this.applyUserFilters();
    });
  }

  loadDashboards(): void {
    this.http.get<any[]>(`${this.api}/dashboards?all=true`)
      .subscribe(data => this.dashboards = data);
  }

  // ── Survey requests ─────────────────────────────────────────────
  loadSurveyRequests(): void {
    this.surveyService.getAllRequests().subscribe({
      next: (data) => {
        this.allRequests = data;
        this.applySurveyFilters();
      },
      error: (err) => console.error('Failed to load survey requests', err)
    });
  }

  // ── Filter helpers ──────────────────────────────────────────────

  /** Returns users filtered by active status */
  get filteredUsers(): any[] {
    if (this.filterActive === null) return this.allUsers;
    return this.allUsers.filter(u => u.is_active === this.filterActive);
  }

  /** Returns survey requests filtered by status */
  get filteredRequests(): SurveyRequest[] {
    if (this.filterSurveyStatus === null) return this.allRequests;
    return this.allRequests.filter(r => r.status === this.filterSurveyStatus);
  }

  // ── Apply filters and reset pagination ──────────────────────────
  applyUserFilters(): void {
    this.userPageIndex = 0;
    this.setUserPage(0);
  }

  applySurveyFilters(): void {
    this.requestPageIndex = 0;
    this.setRequestPage(0);
  }

  // ── Pagination helpers ──────────────────────────────────────────
  setUserPage(index: number): void {
    this.userPageIndex = index;
    const start = index * this.userPageSize;
    const filtered = this.filteredUsers;
    this.usersPage = filtered.slice(start, start + this.userPageSize);
  }

  setRequestPage(index: number): void {
    this.requestPageIndex = index;
    const start = index * this.requestPageSize;
    const filtered = this.filteredRequests;
    this.requestsPage = filtered.slice(start, start + this.requestPageSize);
  }

  // ── Total pages (based on filtered data) ────────────────────────
  get totalUserPages(): number {
    return Math.ceil(this.filteredUsers.length / this.userPageSize);
  }

  get totalRequestPages(): number {
    return Math.ceil(this.filteredRequests.length / this.requestPageSize);
  }

  // ── User actions ─────────────────────────────────────────────────
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
      if (result) this.loadUsers();
    });
  }

  // ── Survey actions ──────────────────────────────────────────────
  updateRequestStatus(requestId: number, newStatus: string): void {
    this.surveyService.updateRequestStatus(requestId, newStatus).subscribe({
      next: () => this.loadSurveyRequests(),
      error: (err) => console.error('Status update failed', err)
    });
  }
}