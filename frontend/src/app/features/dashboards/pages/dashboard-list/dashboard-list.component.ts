import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DashboardListItem, DashboardPaginatedResponse } from 'src/app/core/models/dashboard.model';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { MatDialog } from '@angular/material/dialog';
import { CreateDashboardDialogComponent } from '../../components/create-dashboard-dialog/create-dashboard-dialog.component';
import { HeaderTitleService } from 'src/app/core/services/header-title.service';
import { distinctUntilChanged } from 'rxjs/internal/operators/distinctUntilChanged';
import { debounceTime, Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard-list',
  templateUrl: './dashboard-list.component.html',
  styleUrls: ['./dashboard-list.component.css']
})
export class DashboardListComponent implements OnInit, OnDestroy {
  dashboards: DashboardListItem[] = [];
  isLoading = false;

  // Pagination state
  currentPage = 1;
  pageSize = 15;
  totalItems = 0;
  totalPages = 0;

  // Search
  searchTerm = '';
  private searchSubject = new Subject<string>();
  private searchSub: Subscription = new Subscription;

  constructor(
    private dashboardService: DashboardService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private headerTitleService: HeaderTitleService
  ) {
    this.headerTitleService.setTitle('Dashboards');
  }
  

  ngOnInit(): void {
    // Debounced search – reset to page 1
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm = term;
      this.currentPage = 1;
      this.loadDashboards();
    });

    this.loadDashboards();
  }

  loadDashboards(): void {
    this.isLoading = true;
    this.dashboardService.listDashboards(this.searchTerm, this.currentPage, this.pageSize)
      .subscribe({
        next: (res: DashboardPaginatedResponse) => {
          this.dashboards = res.items;
          this.totalItems = res.total;
          this.totalPages = res.pages;
          this.currentPage = res.page;   // sync with server
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load dashboards', err);
          this.snackBar.open('Failed to load dashboards', 'Close', { duration: 3000 });
          this.isLoading = false;
        },
      });
  }

   onSearchInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.searchSubject.next(input.value);
}

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadDashboards();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadDashboards();
    }
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
          this.loadDashboards();
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

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }
}