import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, switchMap, catchError, of } from 'rxjs';
import { DatasetService } from 'src/app/core/services/dataset.service';
interface DatasetBasic {
  id: number;
  name: string;
}

@Component({
  selector: 'app-dataset-selector',
  templateUrl: './dataset-selector.component.html',
  styleUrls: ['./dataset-selector.component.css']
})
export class DatasetSelectorComponent implements OnInit {
  @Output() datasetSelected = new EventEmitter<{ id: number; columns: string[] }>();

  datasetControl = new FormControl<number | null>(null);
  datasets: DatasetBasic[] = [];
  isLoading = false;
  error = '';

  constructor(private datasetService: DatasetService) {}

  ngOnInit(): void {
    this.loadDatasets();
    this.datasetControl.valueChanges.subscribe(id => {
      if (id) {
        this.loadDatasetColumns(id);
      }
    });
  }

  loadDatasets(): void {
    this.isLoading = true;
    // Assuming your dataset service has a method to list all datasets for the user
    // If not, you need to add it: GET /datasets/
    this.datasetService.getDatasets().subscribe({
      next: (data: any[]) => {
        this.datasets = data.map(d => ({ id: d.id, name: d.name }));
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load datasets';
        this.isLoading = false;
      }
    });
  }

  loadDatasetColumns(datasetId: number): void {
    this.datasetService.getDatasetColumns(datasetId).subscribe({
      next: (columns: any[]) => {
        const columnNames = columns.map(c => c.name); // adjust based on actual response
        this.datasetSelected.emit({ id: datasetId, columns: columnNames });
      },
      error: (err) => {
        console.error('Failed to load columns', err);
        this.error = 'Could not load columns for selected dataset';
      }
    });
  }
}