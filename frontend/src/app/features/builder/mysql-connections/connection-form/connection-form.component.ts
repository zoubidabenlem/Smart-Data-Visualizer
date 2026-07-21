// src/app/features/builder/mysql-connections/connection-form/connection-form.component.ts

import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MySQLConnectionService } from '../../../../core/services/mysql-connection.service';
import { MySQLConnection } from '../../../../core/models/mysql-connection.model';

export interface ConnectionFormData {
  connection?: MySQLConnection;   // if editing
}

@Component({
  selector: 'app-connection-form',
  templateUrl: './connection-form.component.html',
  styleUrls: ['./connection-form.component.css']
})
export class ConnectionFormComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  saving = false;
  testing = false;

  constructor(
    private fb: FormBuilder,
    private service: MySQLConnectionService,
    private dialogRef: MatDialogRef<ConnectionFormComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: ConnectionFormData
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      host: ['', Validators.required],
      port: [3306, [Validators.required, Validators.min(1)]],
      database: ['', Validators.required],
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.data.connection) {
      this.isEdit = true;
      const c = this.data.connection;
      this.form.patchValue({
        name: c.name,
        host: c.host,
        port: c.port,
        database: c.database,
        username: c.username
      });
      this.form.get('password')?.clearValidators();   // password not required for updates
      this.form.get('password')?.updateValueAndValidity();
    }
  }

  /** Save (create or update) – backend will test the connection internally */
  onSubmit(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const payload = { ...this.form.value };

    const request$ = this.isEdit
      ? this.service.update(this.data.connection!.id, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: (conn) => {
        this.snackBar.open(`Connection "${conn.name}" saved`, 'Close', { duration: 2000 });
        this.dialogRef.close(true);
        this.saving = false;
      },
      error: (err) => {
        const msg = err.error?.detail || 'Save failed';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.saving = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}