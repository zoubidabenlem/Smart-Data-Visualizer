import { Component , Output, EventEmitter } from '@angular/core';
import { DatasetService } from '../../../core/services/dataset.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dataset-upload',
  templateUrl: './dataset-upload.component.html',
  styleUrls: ['./dataset-upload.component.css']
})
export class DatasetUploadComponent {
 @Output() uploadSuccess = new EventEmitter<void>();

  selectedFile: File | null = null;
  uploading = false;
  error = '';

  constructor(private datasetService: DatasetService,private router: Router) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.selectedFile = input.files[0];
      this.error = '';
    }
  }

  upload(): void {
    if (!this.selectedFile) {
      this.error = 'Please select a file.';
      return;
    }

    // Validate type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(this.selectedFile.type)) {
      this.error = 'Only CSV and Excel (.xlsx) files are allowed.';
      return;
    }

    // Validate size (max 50 MB)
    const maxSizeMB = 50;
    if (this.selectedFile.size > maxSizeMB * 1024 * 1024) {
      this.error = `File size must be ≤ ${maxSizeMB} MB.`;
      return;
    }

    this.uploading = true;
    this.error = '';

    this.datasetService.upload(this.selectedFile).subscribe({
      next: (dataset) => {
        this.uploading = false;
        this.selectedFile = null;
        // Reset file input
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        this.uploadSuccess.emit();
        this.router.navigate(['/builder/refine', dataset.id]);

      },
      error: (err) => {
        this.uploading = false;
        if (err.status === 415) {
          this.error = 'Unsupported file type. Only CSV and Excel are allowed.';
        } else if (err.status === 413) {
          this.error = 'File too large (max 50 MB).';
        } else if (err.status === 422) {
          this.error = 'Invalid file content. Please check your CSV/Excel format.';
        } else if (err.status === 401 || err.status === 403) {
          this.error = 'You are not authorized to upload.';
        } else {
          this.error = 'Upload failed. Please try again.';
        }
      }
    });
  }
}