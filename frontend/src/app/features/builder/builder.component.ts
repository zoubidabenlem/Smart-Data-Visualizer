// src/app/features/builder/builder.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { DatasetService } from '../../core/services/dataset.service';
import { DatasetOut, PaginatedResponse } from '../../core/models/dataset.model'; // adjust path
import { Router } from '@angular/router';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HeaderTitleService } from 'src/app/core/services/header-title.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-builder',
  templateUrl: './builder.component.html',
  styleUrls: ['./builder.component.css']
})
export class BuilderComponent implements OnInit, OnDestroy {
  datasets: DatasetOut[] = [];
  isLoading = false;
  error = '';
  selectedDatasetId: number | null = null;

  // Pagination state
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Search
  searchTerm = '';
  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  constructor(
    private datasetService: DatasetService,
    private dashboardService: DashboardService,
    private snackBar: MatSnackBar,
    private router: Router,
    private headerTitleService: HeaderTitleService
  ) {
    this.headerTitleService.setTitle('Data Builder');
  }

  ngOnInit(): void {
    // Debounced search – resets to page 1 on new term
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm = term;
      this.currentPage = 1;
      this.loadDatasets();
    });

    // Initial data load
    this.loadDatasets();
    document.title = 'Smart Data Viz | Data Builder';
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  // Main data fetch
  loadDatasets(): void {
    this.isLoading = true;
    this.error = '';
    this.datasetService.getDatasets(this.searchTerm, this.currentPage, this.pageSize)
      .subscribe({
        next: (res: PaginatedResponse) => {
          this.datasets = res.items;
          this.totalItems = res.total;
          this.totalPages = res.pages;
          this.currentPage = res.page;   // ensure sync
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load datasets.';
          this.isLoading = false;
        }
      });
  }

  // Search input handler
  onSearchInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.searchSubject.next(input.value);
}

  // Pagination handlers
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadDatasets();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadDatasets();
    }
  }

  // Existing methods – keep them as they were
  onUploadSuccess(): void {
    this.loadDatasets();
  }

  onDeleteDataset(datasetId: number): void {
    const confirmDelete = window.confirm('Are you sure you want to permanently delete this dataset?');
    if (confirmDelete) {
      this.datasetService.deleteDataset(datasetId).subscribe({
        next: (response) => {
          console.log(response.message);
          this.loadDatasets();
        },
        error: (err) => {
          alert('Could not delete dataset. It might be linked to active dashboards.');
          console.error(err);
        }
      });
    }
  }

  openPreview(id: number): void {
    this.selectedDatasetId = id;
  }

  openRefine(id: number): void {
    this.router.navigate(['/builder/refine', id]);
  }

  navigateToDashboardBuilder(id: number) {
    this.router.navigate(['/dashboard-builder'], { queryParams: { datasetId: id } });
  }

  navigateToUserManagement(id: number) {
    this.router.navigate(['/admin/user'], { queryParams: { datasetId: id } });
  }

  createDashboard(datasetId: number): void {
    const title = 'Untitled Dashboard';
    this.dashboardService.createDashboard({ title }).subscribe({
      next: (res) => {
        this.snackBar.open('Dashboard created! Opening editor…', 'Close', { duration: 2000 });
        this.router.navigate([`/dashboards/${res.id}/edit`], { queryParams: { dataset_id: datasetId } });
      },
      error: (err) => {
        console.error('Dashboard creation failed:', err);
        this.snackBar.open('Failed to create dashboard. Check console.', 'Close', { duration: 4000 });
      },
    });
  }

  
}