import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DashboardListItem } from 'src/app/core/models/dashboard.model';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { MatDialog } from '@angular/material/dialog';
import { CreateDashboardDialogComponent } from '../../components/create-dashboard-dialog/create-dashboard-dialog.component';

@Component({
  selector: 'app-dashboard-list',
  templateUrl: './dashboard-list.component.html',
  styleUrls: ['./dashboard-list.component.css']
})
export class DashboardListComponent implements OnInit {
  dashboards: DashboardListItem[] = [];
  isLoading = false;
  
  constructor(
    private dashboardService: DashboardService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadDashboards();
  }

  loadDashboards(): void {
    this.isLoading = true;
    this.dashboardService.listDashboards().subscribe({
      next: (data) => {
        this.dashboards = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load dashboards', err);
        this.snackBar.open('Failed to load dashboards', 'Close', { duration: 3000 });
        this.isLoading = false;
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateDashboardDialogComponent);
    dialogRef.afterClosed().subscribe((title: string | null) => {
      if (title) {
        this.createDashboard(title);
      }
    });
  }

  createDashboard(title: string): void {
    this.dashboardService.createDashboard({ title }).subscribe({
      next: (res) => {
        this.snackBar.open(`Dashboard "${title}" created`, 'Close', { duration: 2000 });
        // Navigate to editor (route to be created later)
        this.router.navigate(['/dashboards', res.id, 'edit']);
      },
      error: (err) => {
        console.error('Create failed', err);
        this.snackBar.open('Failed to create dashboard', 'Close', { duration: 3000 });
      },
    });
  }

  deleteDashboard(id: number, title: string, event: Event): void {
    event.stopPropagation();
    if (confirm(`Delete dashboard "${title}"? This will also delete all its widgets.`)) {
      this.dashboardService.deleteDashboard(id).subscribe({
        next: () => {
          this.dashboards = this.dashboards.filter(d => d.id !== id);
          this.snackBar.open('Dashboard deleted', 'Close', { duration: 2000 });
        },
        error: (err) => {
          console.error('Delete failed', err);
          this.snackBar.open('Failed to delete dashboard', 'Close', { duration: 3000 });
        },
      });
    }
  }

  editDashboard(id: number): void {
    this.router.navigate(['/dashboards', id, 'edit']);
  }
}