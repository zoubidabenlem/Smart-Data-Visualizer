// src/app/features/dashboards/components/center-canvas/center-canvas.component.ts
import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { GridsterConfig, GridsterItem } from 'angular-gridster2';

import { DashboardEditorService } from '../../services/dashboard-editor.service';
import { GridsterService } from '../../services/gridster.service';
import { DashboardResponse, WidgetResponse } from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-center-canvas',
  templateUrl: './center-canvas.component.html',
  styleUrls: ['./center-canvas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenterCanvasComponent implements OnInit, OnDestroy {
  dashboard$: Observable<DashboardResponse | null>;

  options!: GridsterConfig;
  items: GridsterItem[] = [];
  widgetsById: { [id: number]: WidgetResponse } = {};
  selectedWidgetId: number | null = null;

  private subs = new Subscription();

  constructor(
    private editorService: DashboardEditorService,
    private gridsterService: GridsterService,
    private cdr: ChangeDetectorRef
  ) {
    this.dashboard$ = this.editorService.dashboard$;
  }

  ngOnInit(): void {
    this.options = this.gridsterService.getOptions();
    this.options.itemChangeCallback = (item) => this.handleItemChange(item);
    this.options.itemResizeCallback = (item) => this.handleItemChange(item);

    this.subs.add(
      this.editorService.dashboard$.subscribe(dash => {
        const widgets = dash?.widgets ?? [];
        this.gridsterService.syncWidgets(widgets);

        this.widgetsById = {};
        widgets.forEach(w => (this.widgetsById[w.id] = w));
        this.items = widgets
          .map(w => this.gridsterService.itemMap[w.id])
          .filter((it): it is GridsterItem => !!it);

        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.editorService.selectedWidget$.subscribe(w => {
        this.selectedWidgetId = w?.id ?? null;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  trackByItemId = (_: number, item: GridsterItem): number =>
    (item as any).widgetId as number;

  widgetOf(item: GridsterItem): WidgetResponse | undefined {
    return this.widgetsById[(item as any).widgetId];
  }

  isSelected(item: GridsterItem): boolean {
    return (item as any).widgetId === this.selectedWidgetId;
  }

  onSelectWidget(widget: WidgetResponse | undefined, event: Event): void {
    if (!widget) return;
    event.stopPropagation();
    this.editorService.setSelectedWidget(widget);
  }

  onAddWidget(): void {
    this.editorService.requestCreateWidget();
  }

  private handleItemChange(item: GridsterItem): void {
    const dashboardId = this.editorService.getDashboardId();
    if (!dashboardId) return;
    this.gridsterService.onItemChange(item, dashboardId);
  }
}