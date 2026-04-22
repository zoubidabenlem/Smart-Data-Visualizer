import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatasetService } from '../../../core/services/dataset.service';

interface Column {
  name: string;
  type: string;
}

@Component({
  selector: 'app-column-picker',
  templateUrl: './column-picker.component.html',
  styleUrls: ['./column-picker.component.css']
})
export class ColumnPickerComponent implements OnInit {
  datasetId!: number;
  columns: Column[] = [];
  loading = true;
  error = '';

  selectedXColumn: string = '';
  selectedYColumn: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private datasetService: DatasetService
  ) {}

  ngOnInit(): void {
    this.datasetId = +this.route.snapshot.paramMap.get('datasetId')!;
    this.loadColumns();
  }

  loadColumns(): void {
    this.loading = true;
    this.datasetService.getDatasetColumns(this.datasetId).subscribe({
      next: (cols: Column[]) => {
        this.columns = cols;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load columns. Please try again.';
        this.loading = false;
      }
    });
  }

  onNext(): void {
    if (!this.selectedXColumn || !this.selectedYColumn) {
      // Optionally show error
      return;
    }
    // Store selected columns in a shared service or route state
    // For now, navigate to the next step (e.g., chart type selector)
    this.router.navigate(['/builder/chart-type', this.datasetId], {
      queryParams: { x: this.selectedXColumn, y: this.selectedYColumn }
    });
  }

  onBack(): void {
    this.router.navigate(['/builder/refine', this.datasetId]);
  }
}