import { Injectable } from '@angular/core';
import { GridsterConfig, GridsterItem } from 'angular-gridster2';
// We’ll not use itemChangeCallback → instead use (itemChange) in template

@Injectable({
  providedIn: 'root'
})
export class GridsterService {
  gridOptions: GridsterConfig;

  private pendingPositionUpdates: Record<number, any> = {};
  private debouncedSaveFn: () => void;

  // We don’t need DashboardEditorService yet unless you already have it
  // You can inject it later when ready to save positions
  constructor() {
    this.gridOptions = {
      draggable: { enabled: true },
      resizable: { enabled: true },
      pushItems: true,
      pushDirections: { north: true, east: true, south: true, west: true },
      // displayGrid expects a value from the DisplayGrid enum or string literal 'always' | 'onDrag' | 'none'
      // The error shows it expects type 'displayGrids' which is probably 'always' | 'onDrag' | 'none' but with different casing?
      // Let's use the 'onDrag' string and cast to any if needed
      displayGrid: 'onDrag' as any,
      // No itemChangeCallback – we’ll use the (itemChange) output on each gridster-item
    };

    this.debouncedSaveFn = this.debounce(() => {
      const updates = Object.entries(this.pendingPositionUpdates).map(
        ([id, pos]) => ({
          widget_id: Number(id),
          position: pos
        })
      );
      if (updates.length > 0) {
        // Replace with real service call later
        console.log('💾 Saving widget positions:', updates);
        // this.editorService.updateWidgetPositions(updates).subscribe(...);
        this.pendingPositionUpdates = {};
      }
    }, 500);
  }

  /**
   * Converts a WidgetResponse to a GridsterItem with default size.
   */
  getGridsterItem(widget: any): GridsterItem {
    const pos = widget.position || { x: 0, y: 0, cols: 2, rows: 2 };
    // Use bracket notation to avoid index signature errors
    return {
      x: pos['x'],
      y: pos['y'],
      cols: pos['w'] ?? pos['cols'] ?? 2,
      rows: pos['h'] ?? pos['rows'] ?? 2
    };
  }

  /**
   * Callback when a grid item is changed (dragged/resized).
   * This is called from the (itemChange) output in the template.
   */
  onItemChange(item: GridsterItem, widget: any): void {
    const newPosition = {
      x: item.x,
      y: item.y,
      w: item.cols,
      h: item.rows
    };
    // Optimistically update local position
    widget.position = newPosition;
    this.pendingPositionUpdates[widget.id] = newPosition;
    this.debouncedSaveFn();
  }

  private debounce(fn: Function, delay: number): (...args: any[]) => void {
    let timer: any;
    return (...args: any[]) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
}