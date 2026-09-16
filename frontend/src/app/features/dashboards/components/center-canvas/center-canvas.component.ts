import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { GridsterConfig, GridsterItem } from 'angular-gridster2';

import { AfterViewInit, ElementRef } from '@angular/core';
import { GridsterComponent } from 'angular-gridster2';

import { DashboardEditorService } from '../../services/dashboard-editor.service';
import { GridsterService } from '../../services/gridster.service';
import {
  DashboardPage,
  DashboardResponse,
  WidgetResponse,
} from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-center-canvas',
  templateUrl: './center-canvas.component.html',
  styleUrls: ['./center-canvas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenterCanvasComponent implements OnInit, OnDestroy {
  @ViewChild(GridsterComponent) gridster?: GridsterComponent;

  private resizeObserver: ResizeObserver | null = null;

  dashboard$: Observable<DashboardResponse | null>;

  options!: GridsterConfig;
  
  pages: DashboardPage[] = [];
  activePageId: number | null = null;

  items: GridsterItem[] = [];
  activeWidgets: WidgetResponse[] = [];
  widgetsById: { [id: number]: WidgetResponse } = {};
  selectedWidgetId: number | null = null;

  // Page-tab rename state
  editingPageId: number | null = null;
  editingPageTitle = '';

  private subs = new Subscription();

  constructor(
    private editorService: DashboardEditorService,
    private gridsterService: GridsterService,
    private cdr: ChangeDetectorRef,
    private hostRef: ElementRef<HTMLElement>

  ) {
    this.dashboard$ = this.editorService.dashboard$;
  }

  ngOnInit(): void {
      this.options = this.gridsterService.getOptions();

      this.options.itemChangeCallback = (item) => {
        this.handleItemChange(item);
        this.cdr.markForCheck();
      };
      this.options.itemResizeCallback = (item) => {
        this.handleItemChange(item);
        this.cdr.markForCheck();
      };
      this.options.itemInitCallback = (item) => {
        // Fires once per item after Gridster has auto-placed it.
        // We do NOT want to PATCH on init (no user action), only re-render.
        this.cdr.markForCheck();
          this.recomputePageStats();

      };

    this.subs.add(
      this.editorService.dashboard$.subscribe(dash => {
        if (!dash) {
          this.pages = [];
          this.activeWidgets = [];
          this.items = [];
          this.cdr.markForCheck();
          return;
        }

        this.pages = [...dash.pages].sort((a, b) => a.order - b.order);

        const activeId = this.editorService.getActivePageId() ?? this.pages[0]?.id ?? null;
        this.activePageId = activeId;

        this.activeWidgets = activeId == null
          ? []
          : dash.widgets.filter(w => w.page_id === activeId);

        this.gridsterService.syncWidgets(this.activeWidgets);

        this.widgetsById = {};
        this.activeWidgets.forEach(w => (this.widgetsById[w.id] = w));

        this.items = this.activeWidgets
          .map(w => this.gridsterService.itemMap[w.id])
          .filter((it): it is GridsterItem => !!it);

        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.editorService.activePageId$.subscribe(id => {
        if (id !== this.activePageId) {
          this.activePageId = id;
          // Force a re-read of dashboard for the new page
          const dash = this.editorService.getDashboard();
          if (dash) {
            // trigger the same logic as the dashboard subscription
            this.subs.add; // no-op; keeping linter happy
          }
          this.refreshFromDashboard();
          this.cdr.markForCheck();
        }
      })
    );

    this.subs.add(
      this.editorService.selectedWidget$.subscribe(w => {
        this.selectedWidgetId = w?.id ?? null;
        this.cdr.markForCheck();
      })
    );
  }

  private resizeRaf = 0;

  private scheduleResize(): void {
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.options?.api?.resize?.();
    });
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(this.hostRef.nativeElement);
  }

  ngOnDestroy(): void {
  if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.subs.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  // ─── Page tab handlers ───

  selectPage(pageId: number): void {
    this.editorService.setActivePage(pageId);
  }


  startRenamePage(page: DashboardPage, event: Event): void {
    event.stopPropagation();
    this.editingPageId = page.id;
    this.editingPageTitle = page.title;
    this.cdr.markForCheck();
  }

  commitRenamePage(): void {
    if (this.editingPageId == null) return;
    const title = this.editingPageTitle.trim();
    if (title) {
      this.editorService.renamePage(this.editingPageId, title);
    }
    this.editingPageId = null;
    this.cdr.markForCheck();
  }

  cancelRenamePage(): void {
    this.editingPageId = null;
    this.cdr.markForCheck();
  }

  deletePage(pageId: number, event: Event): void {
    event.stopPropagation();
    if (this.pages.length <= 1) return;
    this.editorService.deletePage(pageId);
  }

  // ─── Gridster/widget handlers ───

  trackByPageId = (_: number, p: DashboardPage): number => p.id;
  trackByItemId = (_: number, item: GridsterItem): number => (item as any).widgetId as number;

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

  private refreshFromDashboard(): void {
    const dash = this.editorService.getDashboard();
    if (!dash) return;

    this.pages = [...dash.pages].sort((a, b) => a.order - b.order);
    this.activePageId = this.editorService.getActivePageId() ?? this.pages[0]?.id ?? null;

    this.activeWidgets = this.activePageId == null
      ? []
      : dash.widgets.filter(w => w.page_id === this.activePageId);

    this.gridsterService.syncWidgets(this.activeWidgets);

    this.widgetsById = {};
    this.activeWidgets.forEach(w => (this.widgetsById[w.id] = w));

    this.items = this.activeWidgets
      .map(w => this.gridsterService.itemMap[w.id])
      .filter((it): it is GridsterItem => !!it);
  }
    chartIcon(type: string | undefined): string {
    switch (type) {
      case 'bar': return 'bar_chart';
      case 'line': return 'show_chart';
      case 'area': return 'area_chart';
      case 'pie': return 'pie_chart';
      case 'scatter': return 'scatter_plot';
      case 'heatmap': return 'grid_on';
      case 'kpi': return 'speed';
      default: return 'insert_chart';
    }
  }

pageStats: { used: number; max: number; nearlyFull: boolean } = {
  used: 0, max: 0, nearlyFull: false,
};

private recomputePageStats(): void {
  const max = this.gridsterService.maxRows;
  let used = 0;
  for (const it of this.items) {
    const bottom = (it.y ?? 0) + (it.rows ?? 1);
    if (bottom > used) used = bottom;
  }
  this.pageStats = { used, max, nearlyFull: used >= max - 4 };
  this.cdr.markForCheck();
}

  addPage(): void {
    this.editorService.createPage().subscribe({
      error: (err) => console.error('Failed to create page', err),
    });
  }
}