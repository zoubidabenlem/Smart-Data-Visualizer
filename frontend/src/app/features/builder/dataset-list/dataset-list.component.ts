// src/app/features/builder/dataset-list/dataset-list.component.ts

import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { DatasetOut } from '../../../core/models/dataset.model';
import { Router } from '@angular/router';

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
  @Output() delete = new EventEmitter<number>();
  @Output() createDashboard = new EventEmitter<number>();


  constructor(private router: Router) {} 


  // Track which row's menu is open (null = none)
  openMenuId: number | null = null;

  toggleMenu(datasetId: number): void {
    this.openMenuId = this.openMenuId === datasetId ? null : datasetId;
  }

  // Called when any action is clicked – close the menu
  onMenuAction(action: 'preview' | 'refine' | 'delete' | 'dashboard', datasetId: number): void {
    this.openMenuId = null;               // close the dropdown
    switch (action) {
      case 'preview': this.preview.emit(datasetId); break;
      case 'refine':  this.refine.emit(datasetId);  break;
      case 'delete':  this.delete.emit(datasetId);  break;
      case 'dashboard': this.createDashboard.emit(datasetId); break;
    }
  }

  goToMySQLConnections(): void {
  this.router.navigate(['/builder/mysql-connections']);
}
  // Inside the class
@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.action-cell')) {
    this.openMenuId = null;
  }}
}