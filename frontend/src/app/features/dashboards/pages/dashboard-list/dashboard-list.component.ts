import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import {
  DashboardListItem,
  DashboardPaginatedResponse,
} from 'src/app/core/models/dashboard.model';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { HeaderTitleService } from 'src/app/core/services/header-title.service';

@Component({
  selector: 'app-dashboard-list',
  templateUrl: './dashboard-list.component.html',
  styleUrls: ['./dashboard-list.component.css'],
})
export class DashboardListComponent implements OnInit, OnDestroy {
  dashboards: DashboardListItem[] = [];
  isLoading = false;
  searchTerm = '';
  currentPage = 1;
  pageSize = 15;
  totalItems = 0;
  totalPages = 0;

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private dashboardService: DashboardService,
    private snackBar: MatSnackBar,
    private router: Router,
    private headerTitleService: HeaderTitleService
  ) {
    this.headerTitleService.setTitle('Dashboards');
  }

  ngOnInit(): void {
    this.searchSub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((term) => {
        this.searchTerm = term;
        this.currentPage = 1;
        this.loadDashboards();
      });
    this.loadDashboards();
  }

  loadDashboards(): void {
    this.isLoading = true;
    this.dashboardService
      .listDashboards(this.currentPage, this.pageSize, this.searchTerm)
      .subscribe({
        next: (res: DashboardPaginatedResponse) => {
          this.dashboards = res.items;
          this.totalItems = res.total;
          this.totalPages = res.pages;
          this.currentPage = res.page;
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

 createDashboard(): void {
  const defaultTitle = 'Untitled Dashboard';
  this.dashboardService.createDashboard({ title: defaultTitle }).subscribe({
    next: (res: { id: number }) => {
      this.snackBar.open('Dashboard created', 'Close', { duration: 2000 });
      this.router.navigate(['/dashboards', res.id, 'edit']);
    },
    error: (err) => {
      console.error('Create failed', err);
      this.snackBar.open('Failed to create dashboard', 'Close', { duration: 3000 });
    }
  });
}

  deleteDashboard(id: number, title: string, event: Event): void {
    event.stopPropagation();
    if (confirm(`Delete dashboard "${title}"? This will also delete all its widgets.`)) {
      this.dashboardService.deleteDashboard(id).subscribe({
        next: () => {
          // If we are on last page and all items deleted, go back one page
          if (this.dashboards.length === 1 && this.currentPage > 1) {
            this.currentPage--;
          }
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