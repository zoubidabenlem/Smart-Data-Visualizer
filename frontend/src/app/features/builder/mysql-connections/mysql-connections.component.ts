// src/app/features/builder/mysql-connections/mysql-connections.component.ts

import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { MySQLConnectionService } from '../../../core/services/mysql-connection.service';
import { MySQLConnection } from '../../../core/models/mysql-connection.model';
import { ConnectionFormComponent } from './connection-form/connection-form.component';

@Component({
  selector: 'app-mysql-connections',
  templateUrl: './mysql-connections.component.html',
  styleUrls: ['./mysql-connections.component.css']
})
export class MySQLConnectionsComponent implements OnInit {
  connections: MySQLConnection[] = [];
  isLoading = false;
  displayedColumns: string[] = ['name', 'host', 'database', 'actions'];

  constructor(
    private service: MySQLConnectionService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadConnections();
  }

  loadConnections(): void {
    this.isLoading = true;
    this.service.list().subscribe({
      next: (data) => {
        this.connections = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.snackBar.open('Failed to load connections', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  onTest(conn: MySQLConnection): void {
    this.service.testConnection(conn.id).subscribe({
      next: () => this.snackBar.open(`Connection "${conn.name}" is working`, 'Close', { duration: 2000 }),
      error: (err) => {
        const msg = err.error?.detail || 'Connection test failed';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      }
    });
  }

  onAdd(): void {
    const dialogRef = this.dialog.open(ConnectionFormComponent, {
      width: '500px',
      data: {}   // empty = create mode
    });
    dialogRef.afterClosed().subscribe(saved => {
      if (saved) this.loadConnections();
    });
  }

  onEdit(conn: MySQLConnection): void {
    const dialogRef = this.dialog.open(ConnectionFormComponent, {
      width: '500px',
      data: { connection: conn }
    });
    dialogRef.afterClosed().subscribe(saved => {
      if (saved) this.loadConnections();
    });
  }

  onDelete(conn: MySQLConnection): void {
    const confirmDelete = window.confirm(`Delete connection "${conn.name}"?`);
    if (!confirmDelete) return;
    this.service.delete(conn.id).subscribe({
      next: () => {
        this.snackBar.open('Connection deleted', 'Close', { duration: 2000 });
        this.loadConnections();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Could not delete connection';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      }
    });
  }

  onExplore(conn: MySQLConnection): void {
    this.router.navigate(['/builder/mysql-connections', conn.id, 'explore']);
  }
}