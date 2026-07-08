import { Injectable } from '@angular/core';
import { GridsterConfig, GridsterItem } from 'angular-gridster2';
import { DashboardEditorService } from '../services/dashboard-editor.service'; // your existing service
import { debounceTime, Subject, switchMap } from 'rxjs';
import { WidgetPosition, WidgetResponse, WidgetPositionUpdatePayload } from 'src/app/core/models/dashboard.model';

@Injectable()
export class GridsterService {
  // Map widget.id -> GridsterItem for quick lookups
  itemMap: { [id: number]: GridsterItem } = {};

  gridOptions: GridsterConfig = {
    gridType: 'fit',               // fills the container
    displayGrid: 'onDrag&Resize',  // show grid lines while interacting
    pushItems: true,               // push neighbours away
    draggable: { enabled: true },
    resizable: {
      enabled: true,
      handles: { s: true, e: true, n: true, w: true, se: true, ne: true, sw: true, nw: true }
    },
    minCols: 12,
    maxCols: 12,
    minRows: 6,
    maxRows: 100,
    fixedRowHeight: 120,           // adjust to your liking
    fixedColWidth: 105,            // adjust
    // Callbacks
   
  };

private debouncedSave = new Subject<WidgetPositionUpdatePayload>();

 // Holds the latest position for each widget (for fast local updates)
  private positions = new Map<number, WidgetPosition>();

  // Subject that emits every time a widget moves or resizes
  private positionChange$ = new Subject<{ id: number; position: WidgetPosition }>();

  constructor(private dashboardEditorService: DashboardEditorService) {
    // Debounced save to backend – only fire after 500ms of inactivity
    this.positionChange$
      .pipe(
        debounceTime(500),
        switchMap(({ id, position }) =>
          this.dashboardEditorService.updateWidgetPosition(id, position)
        )
      )
      .subscribe();  // no need to handle the response (fire-and-forget)
  }

  

  // Call this when widgets are loaded to initialise itemMap
  syncWidgets(widgets: WidgetResponse[]): void {
    this.itemMap = {};
    widgets.forEach(w => {
      this.itemMap[w.id] = this.widgetToGridsterItem(w);
    });
  }

  // Convert backend position to GridsterItem
  private widgetToGridsterItem(widget: WidgetResponse): GridsterItem {
    const pos = widget.position || {};
    return {
      x: pos['x'] ?? 0,
      y: pos['y'] ?? 0,
      cols: pos['cols'] ?? 4,   // default width
      rows: pos['rows'] ?? 3,   // default height
      // You can store widgetId inside the item for retrieval
      widgetId: widget.id
    };
  }

  // When the gridster callback fires, the item object already contains our custom widgetId
  private getWidgetIdFromItem(item: GridsterItem): number | null {
    return (item as any).widgetId ?? null;
  }

  savePosition(widgetId: number, item: GridsterItem): void {
      console.log('[Gridster] savePosition', widgetId, item);

    if (this.itemMap[widgetId]) {
      this.itemMap[widgetId] = { ...item };
    }

    this.debouncedSave.next({
      widgetId,
      position: {
        x: item.x,
        y: item.y,
        cols: item.cols,
        rows: item.rows
      }
    });
  }

  /** Called on (itemChange) – fires when a widget is dragged/dropped */
  onItemChange(event: any, widgetId: number): void {
    // angular-gridster2 emits event = { item: GridsterItem, itemComponent: ... }
    const newPos: WidgetPosition = {
      x: event.item.x,
      y: event.item.y,
      cols: event.item.cols,
      rows: event.item.rows,
    };
    this.updatePosition(widgetId, newPos);
  }

  /** Called on (itemResize) – fires when a widget is resized */
  onItemResize(event: any, widgetId: number): void {
    // angular-gridster2 resize event also contains `item`
    const newPos: WidgetPosition = {
      x: event.item.x,
      y: event.item.y,
      cols: event.item.cols,
      rows: event.item.rows,
    };
    this.updatePosition(widgetId, newPos);
  }

  private updatePosition(id: number, position: WidgetPosition): void {
    // Avoid emitting if position hasn’t actually changed (prevents loops)
      console.log('updatePosition called', id, position);

    const oldPos = this.positions.get(id);
    if (
      oldPos &&
      oldPos.x === position.x &&
      oldPos.y === position.y &&
      oldPos.cols === position.cols &&
      oldPos.rows === position.rows
    ) {
      return;
    }

    this.positions.set(id, position);
    this.positionChange$.next({ id, position });
  }

  
}

 

  