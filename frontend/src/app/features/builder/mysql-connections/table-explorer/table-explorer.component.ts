// src/app/features/builder/mysql-connections/table-explorer/table-explorer.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MySQLConnectionService } from '../../../../core/services/mysql-connection.service';
import { MySQLConnection, MySQLTableColumn, TableListResponse, TableSchemaResponse, TablePreviewResponse, ImportMySQLRequest } from '../../../../core/models/mysql-connection.model';
import { DatasetOut } from '../../../../core/models/dataset.model';
import { ImportDialogComponent } from '../import-dialog/import-dialog.component';

@Component({
  selector: 'app-table-explorer',
  templateUrl: './table-explorer.component.html',
  styleUrls: ['./table-explorer.component.css']
})
export class TableExplorerComponent implements OnInit {
  connectionId!: number;
  connection?: MySQLConnection;
  tables: string[] = [];
  isLoading = false;
  error = '';

  // schema & preview modals
  schemaColumns: MySQLTableColumn[] = [];
  previewRows: any[] = [];
  selectedTable = '';

  constructor(
    private route: ActivatedRoute,
    private service: MySQLConnectionService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.connectionId = +this.route.snapshot.paramMap.get('id')!;
    this.loadConnection();
    this.loadTables();
  }

  private loadConnection(): void {
    this.service.get(this.connectionId).subscribe({
      next: (c) => this.connection = c,
      error: () => this.error = 'Could not load connection details'
    });
  }

  private loadTables(): void {
    this.isLoading = true;
    this.service.listTables(this.connectionId).subscribe({
      next: (res: TableListResponse) => {
        this.tables = res.tables;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load tables';
        this.isLoading = false;
      }
    });
  }
// table-explorer.component.ts (add inside the class)
get previewColumns(): string[] {
  return this.schemaColumns.map(col => col.name);
}
  viewSchema(tableName: string): void {
    this.service.getTableSchema(this.connectionId, tableName).subscribe({
      next: (res) => {
        this.schemaColumns = res.columns;
        // You can open a dialog or show a simple side panel. For brevity we just set and show in template.
      },
      error: () => this.snackBar.open('Could not load schema', 'Close', { duration: 3000 })
    });
  }

  viewPreview(tableName: string): void {
    this.service.getTablePreview(this.connectionId, tableName).subscribe({
      next: (res) => {
        this.previewRows = res.rows;
      },
      error: () => this.snackBar.open('Could not load preview', 'Close', { duration: 3000 })
    });
  }

  openImportDialog(tableName: string): void {
    const dialogRef = this.dialog.open(ImportDialogComponent, {
      width: '400px',
      data: { tableName, connectionId: this.connectionId }
    });

    dialogRef.afterClosed().subscribe((dataset: DatasetOut | undefined) => {
      if (dataset) {
        this.snackBar.open(`Dataset "${dataset.filename}" created from MySQL`, 'Close', { duration: 3000 });
        // Optionally navigate to dataset list
      }
    });
  }
}