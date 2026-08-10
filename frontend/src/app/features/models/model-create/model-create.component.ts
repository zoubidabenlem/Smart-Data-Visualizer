// model-create.component.ts
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DataModelService } from 'src/app/core/services/data-model.service';

@Component({
  selector: 'app-model-create',
  templateUrl: './model-create.component.html',
  styleUrls: ['./model-create.component.css']
})
export class ModelCreateComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private modelService: DataModelService,
    private router: Router,
    public dialogRef: MatDialogRef<ModelCreateComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any // optional data
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.modelService.createModel(this.form.value).subscribe({
      next: (model) => {
        console.log('Model created with ID:', model.id);
        // Close the dialog and pass back the new model (optional)
        this.dialogRef.close(model);
        // Then navigate to studio
        this.router.navigate(['/models', model.id, 'studio']);
      },
      error: (err) => console.error(err)
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}