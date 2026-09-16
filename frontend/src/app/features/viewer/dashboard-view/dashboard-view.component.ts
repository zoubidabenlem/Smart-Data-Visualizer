import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { GridsterConfig, GridsterItem } from 'angular-gridster2';

import { DashboardService } from 'src/app/core/services/dashboard.service';
import {
  DashboardPage,
  DashboardResponse,
  ModelFilterCondition,
  WidgetResponse,
} from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-dashboard-view',
  templateUrl: './dashboard-view.component.html',
  styleUrls: ['./dashboard-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardViewComponent implements OnInit, OnDestroy {
  dashboard: DashboardResponse | null = null;
  loading = true;
  errorMessage = '';

  pages: DashboardPage[] = [];
  activePageId: number | null = null;
  widgetsOnPage: WidgetResponse[] = [];
  items: GridsterItem[] = [];

  viewerFilters: ModelFilterCondition[] = [];
  filtersOpen = false;
  isRefreshing = false;

  options: GridsterConfig = {
    gridType: 'scrollVertical',
    displayGrid: 'none',
    pushItems: false,
    draggable: { enabled: false },
    resizable: { enabled: false },
    minCols: 12,
    maxCols: 12,
    minRows: 6,
    maxRows: 40,
    fixedRowHeight: 110,
    fixedColWidth: 95,
    margin: 8,
    outerMargin: true,
    mobileBreakpoint: 600,
  };

  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage = 'Invalid dashboard id.';
      this.loading = false;
      return;
    }

    this.dashboardService.getDashboard(id).subscribe({
      next: (dash) => {
        this.dashboard = dash;
        this.pages = [...dash.pages].sort((a, b) => a.order - b.order);
        this.activePageId = this.pages[0]?.id ?? null;
        this.rebuild();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[Viewer] load failed', err);
        this.errorMessage = 'Could not load this dashboard.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ─── Pages ───

  selectPage(pageId: number): void {
    if (pageId === this.activePageId) return;
    this.activePageId = pageId;
    this.rebuild();
    if (this.viewerFilters.length > 0) {
      this.refreshWidgetData();
    }
    this.cdr.markForCheck();
  }

  trackByPageId = (_: number, p: DashboardPage): number => p.id;
  trackByItemId = (_: number, it: GridsterItem): number =>
    (it as any).widgetId as number;

  private rebuild(): void {
    if (!this.dashboard || this.activePageId == null) {
      this.widgetsOnPage = [];
      this.items = [];
      return;
    }
    this.widgetsOnPage = this.dashboard.widgets.filter(
      (w) => w.page_id === this.activePageId
    );
    this.items = this.widgetsOnPage.map((w) => this.toItem(w));
  }

  private toItem(w: WidgetResponse): GridsterItem {
    const p = w.position ?? { x: 0, y: 0, cols: 4, rows: 3 };
    return {
      x: p.x,
      y: p.y,
      cols: p.cols,
      rows: p.rows,
      widgetId: w.id,
    } as GridsterItem;
  }

  widgetOf(item: GridsterItem): WidgetResponse | undefined {
    const id = (item as any).widgetId as number;
    return this.widgetsOnPage.find((w) => w.id === id);
  }

  // ─── Filter handlers (called from chip) ───

  onFiltersChange(next: ModelFilterCondition[]): void {
    this.viewerFilters = next;
    this.refreshWidgetData();
    this.cdr.markForCheck();
  }

  onFiltersOpenChange(open: boolean): void {
    this.filtersOpen = open;
    this.cdr.markForCheck();
  }

  private refreshWidgetData(): void {
    if (!this.dashboard) return;
    const modelId = this.dashboard.model_id;
    if (!modelId) return;

    const jobs = this.widgetsOnPage.map((w) => {
      const config = {
        ...w.config,
        filters: [...(w.config.filters ?? []), ...this.viewerFilters],
      };
      return this.dashboardService.getWidgetData(modelId, config).pipe(
        map((res) => ({ id: w.id, data: res.chart_data ?? [] })),
        catchError((err) => {
          console.error(`[Viewer] refresh widget ${w.id} failed`, err);
          return of({ id: w.id, data: [] as any[] });
        })
      );
    });

    if (jobs.length === 0) return;

    this.isRefreshing = true;
    forkJoin(jobs).subscribe({
      next: (results) => {
        const byId = new Map(results.map((r) => [r.id, r.data]));
        this.widgetsOnPage = this.widgetsOnPage.map((w) => ({
          ...w,
          chart_data: byId.get(w.id) ?? w.chart_data,
        }));
        this.isRefreshing = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isRefreshing = false;
        this.cdr.markForCheck();
      },
    });
  }
}