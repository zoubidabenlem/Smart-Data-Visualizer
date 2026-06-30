// src/app/features/builder/builder.component.ts

import { Component, OnInit } from '@angular/core';
import { DatasetService } from '../../core/services/dataset.service';
import { DatasetOut } from '../../core/models/dataset.model';
import { Router } from '@angular/router';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-builder',
  templateUrl: './builder.component.html',
  styleUrls: ['./builder.component.css']
})
export class BuilderComponent implements OnInit {
  datasets: DatasetOut[] = [];
  isLoading = true;
  error = '';
  selectedDatasetId: number | null = null;

  constructor(
    private datasetService: DatasetService,
      private dashboardService: DashboardService,
    private snackBar: MatSnackBar,
  private router: Router
) {}

  ngOnInit(): void {
    
    this.loadDatasets();
  }

  loadDatasets(): void {
    this.isLoading = true;
    this.datasetService.getDatasets().subscribe({
      next: (data) => {
        this.datasets = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load datasets.';
        this.isLoading = false;
      }
    });
  }

  onUploadSuccess(): void {
    this.loadDatasets();
  }

  onDeleteDataset(datasetId: number): void {
    const confirmDelete = window.confirm('Are you sure you want to permanently delete this dataset?');
    
    if (confirmDelete) {
      this.datasetService.deleteDataset(datasetId).subscribe({
        next: (response) => {
          console.log(response.message);
          // Refresh the list immediately so the deleted row disappears
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
  // Change '/refine-sandbox' to '/refine' to match builder-routing.module.ts
  this.router.navigate(['/builder/refine', id]);
}

  // src/app/features/builder/builder.component.ts
  navigateToDashboardBuilder(id: number) {
  this.router.navigate(['/dashboard-builder'], { queryParams: { datasetId: id } });
}

 navigateToUserManagement(id: number) {
  this.router.navigate(['/admin/user'], { queryParams: { datasetId: id } });
}

// Handler for dataset-list "Create Dashboard" button
  createDashboard(datasetId: number): void {
    const title = 'Untitled Dashboard'; // generic title
    this.dashboardService.createDashboard({ title }).subscribe({
      next: (res) => {
        this.snackBar.open('Dashboard created! Opening editor…', 'Close', {
          duration: 2000,
        });
        this.router.navigate([`/dashboards/${res.id}/edit`], {
          queryParams: { dataset_id: datasetId },
        });
      },
      error: (err) => {
        console.error('Dashboard creation failed:', err);
        this.snackBar.open(
          'Failed to create dashboard. Check console.',
          'Close',
          { duration: 4000 }
        );
      },
    });
  }
  

}