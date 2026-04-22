import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ChartBuilderStateService {
  private xColumn: string = '';
  private yColumn: string = '';

  setColumns(x: string, y: string) {
    this.xColumn = x;
    this.yColumn = y;
  }

  getColumns() {
    return { x: this.xColumn, y: this.yColumn };
  }
}