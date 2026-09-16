// src/app/features/dashboards/services/gridster.service.ts
import { Injectable } from '@angular/core';
import { GridsterConfig, GridsterItem } from 'angular-gridster2';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';
import { WidgetPosition, WidgetResponse } from 'src/app/core/models/dashboard.model';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { DashboardEditorService } from './dashboard-editor.service';

@Injectable()
export class GridsterService {
  /** Gridster items keyed by widget id. Stable across dashboard emits. */
  itemMap: { [id: number]: GridsterItem } = {};

  private gridOptions: GridsterConfig = {
    gridType: 'scrollVertical',
    displayGrid: 'onDrag&Resize',
    pushItems: true,
    draggable: { enabled: true },
    resizable: {
      enabled: true,
      handles: { s: true, e: true, n: true, w: true, se: true, ne: true, sw: true, nw: true },
    },
    minCols: 12,
    maxCols: 12,
    minRows: 6,
    maxRows: 10,
    fixedRowHeight: 110,
    fixedColWidth: 95,
    margin: 8,
    outerMargin: true,
    mobileBreakpoint: 600,
    // We assign the callbacks in the component so they can capture dashboardId.
    itemChangeCallback: undefined,
    itemResizeCallback: undefined,
    itemInitCallback: undefined,   // wired in the component, like the others
  };

  private positionChange$ = new Subject<{
    dashboardId: number;
    widgetId: number;
    position: WidgetPosition;
  }>();

  

  constructor(
    private dashboardService: DashboardService,
    private editorService: DashboardEditorService
  ) {
    this.positionChange$.pipe(
      debounceTime(500),
      switchMap(({ dashboardId, widgetId, position }) =>
        this.dashboardService.updateWidgetPosition(dashboardId, widgetId, position).pipe(
          catchError((err) => {
            console.error('[GridsterService] position save failed', err);
            return of(null);
          })
        )
      )
    ).subscribe();
  }
  get maxRows(): number {
    return this.gridOptions.maxRows ?? 5;
  }
  getOptions(): GridsterConfig {
    return this.gridOptions;
  }

  

    /**
   * Reconcile itemMap against the given widget list.
   *
   * IMPORTANT: we do NOT clear the map. Gridster mutates items in place during
   * drag/resize; if we wiped the map on every page switch, in-flight position
   * changes would be lost before the PATCH debounce fires.
   *
   * We only:
   *   - add entries for widgets we've never seen
   *   - remove entries for widgets that no longer exist (deleted)
   *   - leave existing entries untouched (Gridster already owns their state)
   */
  syncWidgets(widgets: WidgetResponse[]): void {
    const presentIds = new Set(widgets.map((w) => w.id));

    // Drop entries for widgets that no longer exist anywhere.
    for (const key of Object.keys(this.itemMap)) {
      const id = Number(key);
      if (!presentIds.has(id)) {
        delete this.itemMap[id];
      }
    }

    // Add new widgets. Existing entries keep their in-memory position.
    for (const w of widgets) {
      if (!this.itemMap[w.id]) {
        this.itemMap[w.id] = this.widgetToGridsterItem(w);
      }
    }
  }

  onItemChange(item: GridsterItem, dashboardId: number): void {
    const widgetId = (item as any).widgetId as number | undefined;
    if (!widgetId || !dashboardId) return;
    this.queuePositionUpdate(dashboardId, widgetId, {
      x: item.x,
      y: item.y,
      cols: item.cols,
      rows: item.rows,
    });
    console.log('widget position changed', { dashboardId, widgetId, item });
  }

private widgetToGridsterItem(widget: WidgetResponse): GridsterItem {
  const pos: WidgetPosition = widget.position ?? { x: 0, y: 0, cols: 4, rows: 3 };

  const collides = Object.values(this.itemMap).some(
    (it) => it.x === pos.x && it.y === pos.y
  );

  const item: any = {
    cols: pos.cols,
    rows: pos.rows,
    widgetId: widget.id,
  };

  // Only pin x/y when the requested cell is free.
  // Otherwise leave them undefined so Gridster auto-places (pushItems: true).
  if (!collides) {
    item.x = pos.x;
    item.y = pos.y;
  }
  return item as GridsterItem;
}

    private queuePositionUpdate(
    dashboardId: number,
    widgetId: number,
    position: WidgetPosition
  ): void {
    const item = this.itemMap[widgetId];
    if (item) {
      item.x = position.x;
      item.y = position.y;
      item.cols = position.cols;
      item.rows = position.rows;
    }

     // ...item map update as above...
    this.editorService.patchWidgetPositionLocally(widgetId, position);
    this.positionChange$.next({ dashboardId, widgetId, position });
  }
}