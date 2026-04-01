// src/app/features/builder/preview-modal/preview-modal.component.ts

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { DatasetService } from '../../../core/services/dataset.service';

@Component({
  selector: 'app-preview-modal',
  templateUrl: './preview-modal.component.html',
  styleUrls: ['./preview-modal.component.css']
})
export class PreviewModalComponent implements OnInit {
  @Input() datasetId!: number;
  @Output() close = new EventEmitter<void>();

  rows: any[] = [];
  columns: string[] = [];
  isLoading = true;
  error = '';
  cached = false;

  constructor(private datasetService: DatasetService) {}

  ngOnInit(): void {
    this.datasetService.getPreview(this.datasetId).subscribe({
      next: (res) => {
        this.rows = res.data;
        this.cached = res.cached;
        if (this.rows.length > 0) {
          this.columns = Object.keys(this.rows[0]);
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load preview.';
        this.isLoading = false;
      }
    });
  }

  closeModal() {
    this.close.emit();
  }
}