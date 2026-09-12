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

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ─── Page tab handlers ───

  selectPage(pageId: number): void {
    this.editorService.setActivePage(pageId);
  }

  addPage(): void {
    this.editorService.createPage().subscribe({
      error: (err) => console.error('Failed to create page', err),
    });
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
}