// src/app/features/builder/dataset-list/dataset-list.component.ts

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatasetOut } from '../../../core/models/dataset.model';

@Component({
  selector: 'app-dataset-list',
  templateUrl: './dataset-list.component.html',
  styleUrls: ['./dataset-list.component.css']
})
export class DatasetListComponent {
  @Input() datasets: DatasetOut[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Output() preview = new EventEmitter<number>();
  @Output() refine = new EventEmitter<number>();   

}