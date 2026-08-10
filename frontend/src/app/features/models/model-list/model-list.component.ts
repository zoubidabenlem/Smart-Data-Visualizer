import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataModelOut } from 'src/app/core/models/data-model.model';
import { DataModelService } from 'src/app/core/services/data-model.service';
import { ModelCreateComponent } from '../model-create/model-create.component';

@Component({
  selector: 'app-model-list',
  templateUrl: './model-list.component.html',
  styleUrls: ['./model-list.component.css']
})
export class ModelListComponent implements OnInit, OnDestroy {
  models: DataModelOut[] = [];
  total = 0;
  page = 1;
  size = 20;
  isLoading = false;
  errorMessage = '';
  openMenuId: number | null = null;


  private destroy$ = new Subject<void>();

  constructor(private modelService: DataModelService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.loadModels();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadModels(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.modelService.getModels(this.page, this.size)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.models = res?.models ?? [];
          this.total = res?.total ?? 0;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load models:', err);
          this.errorMessage = 'Could not load data models. Please try again.';
          this.isLoading = false;
        }
      });
  }

  deleteModel(id: number): void {
    if (!confirm('Are you sure you want to delete this model?')) {
      return;
    }

    this.isLoading = true;
    this.modelService.deleteModel(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadModels(),
        error: (err) => {
          console.error('Failed to delete model:', err);
          this.errorMessage = 'Could not delete the model.';
          this.isLoading = false;
        }
      });
  }

  trackById(index: number, item: DataModelOut): number {
    return item.id;
  }

toggleMenu(id: number): void {
  this.openMenuId = this.openMenuId === id ? null : id;
}

// Optional: close menu when clicking outside – you can add a HostListener later
onMenuAction(action: string, id: number): void {
  if (action === 'delete') {
    this.deleteModel(id);
  }
  this.openMenuId = null;
}
 /**
   * Evaluates dataset presence and returns the corresponding CSS status class
   */
  getStatusClass(model: DataModelOut): string {
    if (!model.datasets || model.datasets.length === 0) {
      return 'status-empty';
    }
    
    // Add additional conditional logic here later if datasets have nested statuses
    // e.g., if (model.datasets.some(d => d.status === 'error')) return 'status-error';

    return 'status-refined';
  }

  // Add this line at the very top of your TS class properties to make Math usable in HTML
protected readonly Math = Math;



// Use this for Option 2 (Angular Material Paginator)
handleMaterialPageEvent(event: any): void {
  this.page = event.pageIndex + 1; // Material uses 0-based indexing
  this.size = event.pageSize;
  this.loadModels();
}
// model-list.component.ts
openCreateDialog(): void {
  const dialogRef = this.dialog.open(ModelCreateComponent, {
    width: '500px',
    // You can pass data if needed: data: { some: 'value' }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      // If the dialog returned the new model, reload the list
      this.loadModels();
    }
  });
}

}
