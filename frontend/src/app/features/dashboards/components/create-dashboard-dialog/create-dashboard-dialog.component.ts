import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-create-dashboard-dialog',
  templateUrl: './create-dashboard-dialog.component.html',
  styleUrls: ['./create-dashboard-dialog.component.css']
})
export class CreateDashboardDialogComponent {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateDashboardDialogComponent>

  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value.title);
    }
  }

  onCancel() {
    this.dialogRef.close();
  }


}
