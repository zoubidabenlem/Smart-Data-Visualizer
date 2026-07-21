// src/app/features/builder/mysql-connections/import-dialog/import-dialog.component.ts

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MySQLConnectionService } from '../../../../core/services/mysql-connection.service';
import { DatasetOut } from '../../../../core/models/dataset.model';

export interface ImportDialogData {
  tableName: string;
  connectionId: number;
}

@Component({
  selector: 'app-import-dialog',
  templateUrl: './import-dialog.component.html',
  styleUrls: ['./import-dialog.component.css']
})
export class ImportDialogComponent {
  importing = false;

  constructor(
    private dialogRef: MatDialogRef<ImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ImportDialogData,
    private service: MySQLConnectionService,
    private snackBar: MatSnackBar
  ) {}

  onConfirm(): void {
    this.importing = true;
    this.service.importTable({
      connection_id: this.data.connectionId,
      table_name: this.data.tableName
    }).subscribe({
      next: (dataset: DatasetOut) => {
        this.dialogRef.close(dataset);
        this.importing = false;
      },
      error: (err) => {
        this.snackBar.open(err.error?.detail || 'Import failed', 'Close', { duration: 4000 });
        this.importing = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}