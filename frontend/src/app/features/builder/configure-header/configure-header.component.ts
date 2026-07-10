// src/app/components/configure-header/configure-header.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfigureHeaderRequest, RawPreviewResponse } from 'src/app/core/models/dataset.model';
import { DatasetService } from 'src/app/core/services/dataset.service';
import { HeaderTitleService } from 'src/app/core/services/header-title.service';

@Component({
  selector: 'app-configure-header',
  templateUrl: './configure-header.component.html',
  styleUrls: ['./configure-header.component.css']
})
export class ConfigureHeaderComponent implements OnInit,  OnDestroy {
  datasetId!: number;
  headerRow = 0;
  skipRows: number[] = [];
  columnNames: { [key: string]: string } = {};
  previewData: RawPreviewResponse | null = null;
  loading = false;
  error = '';
  private isProcessingAction = false; 


  constructor(
    private route: ActivatedRoute,
    private datasetService: DatasetService,
    private router: Router,
    private headerTitleService: HeaderTitleService
  ) {
this.headerTitleService.setTitle('Configure Header');
  }
  ngOnDestroy(): void {
    if (!this.isProcessingAction && this.datasetId) {
      console.warn(`User closed tab or clicked navbar logo. Purging unconfigured dataset #${this.datasetId}`);
      this.datasetService.deleteDataset(Number(this.datasetId)).subscribe();
    }

  }
   onCancel(): void {
    const confirmCancel = window.confirm('Are you sure you want to cancel? This uploaded file will be discarded.');
    if (!confirmCancel) return;

    this.loading = true;
    this.isProcessingAction = true; // Sets flag to ignore the destruction lifecycle script

    this.datasetService.deleteDataset(Number(this.datasetId)).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/builder']); 
      },
      error: (err) => {
        this.loading = false;
        this.isProcessingAction = false;
        this.error = 'Failed to delete the unconfigured file from the server.';
      }
    });
  }
  onConfigureHeaderOpened() {
  // Appends your deep nested configuration state instantly without clearing "Data Builder"
  this.headerTitleService.appendSubTitle('Configure Header');
}

onConfigureHeaderClosed() {
  // Easily drops the appended string array when your user returns to the primary view
  this.headerTitleService.resetToBase();
}

  ngOnInit(): void {
    this.datasetId = +this.route.snapshot.paramMap.get('id')!;
    this.fetchPreview();
  }

  fetchPreview() {
    this.loading = true;
    this.datasetService.getRawPreview(this.datasetId, this.headerRow, this.skipRows).subscribe({
      next: (data) => {
        this.previewData = data;
        // Initialise column names with current column names
        if (data.columns) {
          for (const col of data.columns) {
            if (!this.columnNames[col]) {
              this.columnNames[col] = col;
            }
          }
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.detail || 'Failed to load preview';
        this.loading = false;
      }
    });
  }

  onHeaderRowChange(value: number) {
    this.headerRow = value;
      this.skipRows = []; //Clear selected checkmarks so they don't break lower row selections

    this.fetchPreview();
  }

  // Add this helper function inside your ConfigureHeaderComponent class
  getAvailableSkipRows(): number[] {
    // Generates a true array of indices up to the current header row index
    // e.g., if headerRow = 3, returns [0, 1, 2]
    return Array.from({ length: this.headerRow }, (_, i) => i);
  }


  onSkipRowToggle(rowIndex: number, checked: boolean) {
    if (checked) {
      this.skipRows.push(rowIndex);
    } else {
      this.skipRows = this.skipRows.filter(r => r !== rowIndex);
    }
    this.fetchPreview();
  }

  onColumnNameChange(original: string, newName: string) {
    this.columnNames[original] = newName;
  }

  submitConfiguration(): void {
    this.loading = true;
    const config: ConfigureHeaderRequest = {
      header_row: this.headerRow,
      skip_rows: this.skipRows,
      column_names: this.columnNames
    };

    this.datasetService.configureHeader(this.datasetId, config).subscribe({
      next: () => {
        this.loading = false;
        this.isProcessingAction = true; // Sets flag to ignore the destruction lifecycle script
        this.router.navigate(['/builder/refine', this.datasetId]);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.detail || 'Configuration failed';
      }
    });
  }
}