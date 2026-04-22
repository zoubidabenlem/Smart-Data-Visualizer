// src/app/features/builder/builder.component.ts

import { Component, OnInit } from '@angular/core';
import { DatasetService } from '../../core/services/dataset.service';
import { DatasetOut } from '../../core/models/dataset.model';
import { Router } from '@angular/router';

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

  openPreview(id: number): void {
    this.selectedDatasetId = id;
  }

  openRefine(id: number): void {
    this.router.navigate(['/builder/refine', id]);
  }
}