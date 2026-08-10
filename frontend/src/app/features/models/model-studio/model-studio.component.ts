import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataModelService } from 'src/app/core/services/data-model.service';
import { DatasetService } from 'src/app/core/services/dataset.service'; // adjust path
import { DataModelOut, DataModelUpdateRequest } from 'src/app/core/models/data-model.model'; // adjust imports
import { ColumnSchema, DatasetOut } from 'src/app/core/models/dataset.model';

// Local interface for attached datasets (with alias & columns)
interface DatasetBox {
  dataset: DatasetOut;
  alias: string | null;
  columns: ColumnSchema[];
}

// Request payloads (define these in your core models if not already)
interface AddDatasetsToModelRequest {
  datasets: { dataset_id: number }[];
}

interface TableRelationshipCreateRequest {
  left_dataset_id: number;
  right_dataset_id: number;
  left_column: string;
  right_column: string;
  join_type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

@Component({
  selector: 'app-model-studio',
  templateUrl: './model-studio.component.html',
  styleUrls: ['./model-studio.component.css']
})
export class ModelStudioComponent implements OnInit,AfterViewInit {
  modelId!: number;
  model: DataModelOut | null = null;

  // Left sidebar: recent datasets
  recentDatasets: DatasetOut[] = [];

  // Canvas: attached datasets (with columns)
  attachedDatasets: DatasetBox[] = [];

  // Relationship builder state
  sourceColumn: { datasetId: number; column: string } | null = null;
  targetColumn: { datasetId: number; column: string } | null = null;
  pendingJoinType: JoinType = 'INNER';

  // Search term (optional)
  searchTerm = '';
   // Collapsible state
  isDatasetsCollapsed = false;
  isRelationshipCollapsed = false;
  isLoading=false;
  // Add these properties inside the component class
isExistingRelationsCollapsed = false;

@ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('lineSvg') lineSvg!: ElementRef<SVGElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modelService: DataModelService,
    private datasetService: DatasetService
  ) {}
  ngAfterViewInit(): void {
     this.drawRelationshipLines();
}
@HostListener('window:resize', ['$event'])
onResize(): void {
  this.drawRelationshipLines();
}


  ngOnInit(): void {
    this.modelId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.modelId) {
      this.router.navigate(['/models']);
      return;
    }
    this.loadModel();
    this.loadRecentDatasets();
  }
   // Toggle methods
  toggleDatasets(): void {
    this.isDatasetsCollapsed = !this.isDatasetsCollapsed;
  }

  toggleRelationship(): void {
    this.isRelationshipCollapsed = !this.isRelationshipCollapsed;
  }
  // Add this method
toggleExistingRelations(): void {
  this.isExistingRelationsCollapsed = !this.isExistingRelationsCollapsed;
}

  // ---------- Data Loading ----------
  loadModel(): void {
    this.modelService.getModel(this.modelId).subscribe({
      next: (model) => {
        this.model = model;
        this.buildAttachedBoxes();
        this.drawRelationshipLines(); // <-- Add this

      },
      error: () => this.router.navigate(['/models'])
    });
  }

  loadRecentDatasets(): void {
    // Adjust method signature to match your service – e.g., listDatasets(search, page, size)
    this.datasetService.getDatasets('', 1, 5).subscribe({
      next: (res) => {
        // Assume res.items is the array; if your service returns a different shape, adapt
        this.recentDatasets = res.items || res || [];
      },
      error: (err) => console.error('Failed to load recent datasets', err)
    });
  }

  buildAttachedBoxes(): void {
    if (!this.model) return;
    this.attachedDatasets = this.model.datasets.map(md => ({
      dataset: md.dataset,
      alias: md.alias,
      columns: md.dataset.column_schema || []
    }));
  }

  // ---------- Sidebar: Add Dataset ----------
  addDatasetToModel(dataset: DatasetOut): void {
    if (this.attachedDatasets.find(b => b.dataset.id === dataset.id)) {
      alert('This dataset is already attached to the model.');
      return;
    }
    const payload: AddDatasetsToModelRequest = {
      datasets: [{ dataset_id: dataset.id }]
    };
    this.modelService.addDatasetsToModel(this.modelId, payload).subscribe({
      next: () => this.loadModel(), // refresh the whole model
      error: (err) => console.error('Failed to add dataset', err)
    });
  }

  // ---------- Canvas: Remove Dataset ----------
  removeDataset(datasetId: number): void {
    if (!confirm('Remove this dataset from the model?')) return;
    this.modelService.removeDatasetFromModel(this.modelId, datasetId).subscribe({
      next: () => this.loadModel(),
      error: (err) => console.error('Failed to remove dataset', err)
    });
  }

  // ---------- Column Selection (click‑based) ----------
  selectColumn(datasetId: number, columnName: string): void {
    if (!this.sourceColumn) {
      // First click: set as source
      this.sourceColumn = { datasetId, column: columnName };
    } else if (this.sourceColumn.datasetId === datasetId) {
      // Click on same dataset: toggle source or clear
      if (this.sourceColumn.column === columnName) {
        this.clearSelection();
      } else {
        this.sourceColumn = { datasetId, column: columnName };
      }
    } else {
      // Click on a different dataset: set as target
      this.targetColumn = { datasetId, column: columnName };
      // Optionally you could auto‑save or just show the properties panel
    }
  }

  isColumnSelected(datasetId: number, colName: string): boolean {
    return (this.sourceColumn?.datasetId === datasetId && this.sourceColumn?.column === colName) ||
           (this.targetColumn?.datasetId === datasetId && this.targetColumn?.column === colName);
  }

  clearSelection(): void {
    this.sourceColumn = null;
    this.targetColumn = null;
  }

  // ---------- Save Relationship ----------
  saveRelationship(): void {
    if (!this.sourceColumn || !this.targetColumn) return;

    const payload: TableRelationshipCreateRequest = {
      left_dataset_id: this.sourceColumn.datasetId,
      right_dataset_id: this.targetColumn.datasetId,
      left_column: this.sourceColumn.column,
      right_column: this.targetColumn.column,
      join_type: this.pendingJoinType,
    };

    this.modelService.createRelationship(this.modelId, payload).subscribe({
      next: (rel) => {
        // Add relationship to the model locally (optional, or reload)
        if (this.model) {
          this.model.relationships = this.model.relationships || [];
          this.model.relationships.push(rel);
        }
        this.clearSelection();
        this.drawRelationshipLines(); // <-- Add this

      },
      error: (err) => console.error('Failed to create relationship', err)
    });
  }

  // ---------- Delete Relationship ----------
  deleteRelationship(relId: number): void {
    if (!confirm('Delete this relationship?')) return;
    this.modelService.deleteRelationship(this.modelId, relId).subscribe({
      next: () => {
        // Remove from local model or reload
        if (this.model) {
          this.model.relationships = this.model.relationships.filter(r => r.id !== relId);
        }
        this.drawRelationshipLines(); // <-- Add this

      },
      error: (err) => console.error('Failed to delete relationship', err)
    });
  }

  // Optional: search filtering on recent datasets
  searchDatasets(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    // You could call the service with the search term, or filter locally
    // For now, we'll keep it simple – you can implement a local filter
  }

  // In the class, add:
isSaving = false;
saveSuccess = false;

// Method to save model metadata
saveModelLayout(): void {
  if (!this.model) return;
  this.isSaving = true;
  this.saveSuccess = false;

  const payload: DataModelUpdateRequest = {
    name: this.model.name,
    base_dataset_id: this.model.base_dataset_id || undefined
  }

  this.modelService.updateModel(this.modelId, payload).subscribe({
    next: (updated) => {
      this.model = updated;
      this.isSaving = false;
      this.saveSuccess = true;
      setTimeout(() => this.saveSuccess = false, 3000); // auto-hide success
      this.router.navigate(['/models', this.modelId, 'view']); // optional: refresh or navigate
    },
    error: (err) => {
      console.error('Save failed:', err);
      this.isSaving = false;
      alert('Failed to save model. Please try again.');
    }
  });
  }
  /**
 * Draws SVG arrows between dataset boxes that have relationships.
 */
drawRelationshipLines(): void {
  if (!this.model?.relationships?.length || !this.canvasContainer) {
    if (this.lineSvg) this.lineSvg.nativeElement.innerHTML = '';
    return;
  }

  const container = this.canvasContainer.nativeElement;
  const svg = this.lineSvg.nativeElement;
  const containerRect = container.getBoundingClientRect();

  // Resize SVG to cover the scrollable area
  svg.style.width = container.scrollWidth + 'px';
  svg.style.height = container.scrollHeight + 'px';

  let svgContent = '';
  const boxes = Array.from(container.querySelectorAll('.dataset-box')) as HTMLElement[];

  this.model.relationships.forEach(rel => {
    // Find the dataset boxes
    const leftBox = boxes.find(b => parseInt(b.getAttribute('data-id') || '0') === rel.left_dataset_id);
    const rightBox = boxes.find(b => parseInt(b.getAttribute('data-id') || '0') === rel.right_dataset_id);

    if (!leftBox || !rightBox) return;

    // IMPORTANT: Find the specific <li> containing the column name
    // We use `textContent.trim().startsWith()` to match just the column name before the type
    const leftLi = Array.from(leftBox.querySelectorAll('li')).find(li => 
      li.textContent?.trim().startsWith(rel.left_column)
    );
    const rightLi = Array.from(rightBox.querySelectorAll('li')).find(li => 
      li.textContent?.trim().startsWith(rel.right_column)
    );

    // If we found the column LI, use it; otherwise, fallback to the entire box
    const leftRect = leftLi ? leftLi.getBoundingClientRect() : leftBox.getBoundingClientRect();
    const rightRect = rightLi ? rightLi.getBoundingClientRect() : rightBox.getBoundingClientRect();

    // Calculate points: Right edge of left column, Left edge of right column
    const x1 = leftRect.right - containerRect.left;
    const y1 = leftRect.top + leftRect.height / 2 - containerRect.top;
    const x2 = rightRect.left - containerRect.left;
    const y2 = rightRect.top + rightRect.height / 2 - containerRect.top;

    // Draw dashed line
    svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                       stroke="#2ca58d" stroke-width="2.5" stroke-dasharray="6,4" />`;

    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 12;
    const headAngle = Math.PI / 6;
    const ax = x2 - headLen * Math.cos(angle - headAngle);
    const ay = y2 - headLen * Math.sin(angle - headAngle);
    const bx = x2 - headLen * Math.cos(angle + headAngle);
    const by = y2 - headLen * Math.sin(angle + headAngle);

    svgContent += `<polygon points="${x2},${y2} ${ax},${ay} ${bx},${by}" 
                         fill="#2ca58d" />`;
  });

  svg.innerHTML = svgContent;
}

}