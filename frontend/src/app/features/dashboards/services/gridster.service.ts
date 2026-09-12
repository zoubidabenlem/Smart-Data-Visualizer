// src/app/features/dashboards/services/gridster.service.ts
import { Injectable } from '@angular/core';
import { GridsterConfig, GridsterItem } from 'angular-gridster2';
import { debounceTime, Subject, switchMap } from 'rxjs';
import { WidgetPosition, WidgetResponse } from 'src/app/core/models/dashboard.model';
import { DashboardService } from 'src/app/core/services/dashboard.service';

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
    maxRows: 200,
    fixedRowHeight: 110,
    fixedColWidth: 95,
    margin: 8,
    outerMargin: true,
    mobileBreakpoint: 600,
    // We assign the callbacks in the component so they can capture dashboardId.
    itemChangeCallback: undefined,
    itemResizeCallback: undefined,
  };

  private positionChange$ = new Subject<{
    dashboardId: number;
    widgetId: number;
    position: WidgetPosition;
  }>();

  constructor(private dashboardService: DashboardService) {
    this.positionChange$
      .pipe(
        debounceTime(500),
        switchMap(({ dashboardId, widgetId, position }) =>
          this.dashboardService.updateWidgetPosition(dashboardId, widgetId, position)
        )
      )
      .subscribe({
        error: (err) => console.error('[GridsterService] position save failed', err),
      });
  }

  getOptions(): GridsterConfig {
    return this.gridOptions;
  }

  /**
   * Reconcile itemMap against the current widget list.
   * Keeps x/y/cols/rows stable for widgets that already exist.
   */
  syncWidgets(widgets: WidgetResponse[]): void {
    const next: { [id: number]: GridsterItem } = {};
    widgets.forEach(w => {
      next[w.id] = this.itemMap[w.id] ?? this.widgetToGridsterItem(w);
    });
    this.itemMap = next;
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
  }

  private widgetToGridsterItem(widget: WidgetResponse): GridsterItem {
    const pos: WidgetPosition = widget.position ?? { x: 0, y: 0, cols: 4, rows: 3 };
    return {
      x: pos.x,
      y: pos.y,
      cols: pos.cols,
      rows: pos.rows,
      widgetId: widget.id,
    } as GridsterItem;
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
    this.positionChange$.next({ dashboardId, widgetId, position });
  }
}