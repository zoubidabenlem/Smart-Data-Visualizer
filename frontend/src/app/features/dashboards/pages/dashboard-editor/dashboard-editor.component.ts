import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { DataModelService } from 'src/app/core/services/data-model.service';
import { DashboardEditorService } from '../../services/dashboard-editor.service';
import {
  DashboardResponse,
  WidgetConfig,
  WidgetResponse,
} from 'src/app/core/models/dashboard.model';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DataModelOut } from 'src/app/core/models/data-model.model';

@Component({
  selector: 'app-dashboard-editor',
  templateUrl: './dashboard-editor.component.html',
  styleUrls: ['./dashboard-editor.component.css'],
})
export class DashboardEditorComponent implements OnInit, OnDestroy {
  dashboardId!: number;
  dashboard: DashboardResponse | null = null;
  modelId: number | null = null;
  selectedModel: DataModelOut | null = null;

  isRenaming = false;
  renameTitle = '';

  leftCollapsed = false;
  rightCollapsed = false;

  private subscriptions = new Subscription();

  // ─── DEBUG: toggle at runtime with `window.__dashDebug = true` ───
  private get DEBUG(): boolean {
    return (window as any).__dashDebug === true;
  }
  private log(...args: any[]): void {
    if (this.DEBUG) console.log('[DashboardEditor]', ...args);
  }

  constructor(
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private dashboardService: DashboardService,
    private dataModelService: DataModelService,
    private editorService: DashboardEditorService
  ) {}

  ngOnInit(): void {
    this.dashboardId = Number(this.route.snapshot.paramMap.get('id'));
    this.log('ngOnInit – dashboardId =', this.dashboardId);
    this.loadDashboard();

    this.subscriptions.add(
      this.editorService.createWidgetRequest$.subscribe(() => {
        this.log('createWidgetRequest received');
        this.addNewWidget();
      })
    );

    // ─── DEBUG: also log every change to the dashboard state ───
    this.subscriptions.add(
      this.editorService.dashboard$.subscribe(dash => {
        this.log('dashboard$ emitted – widgets =', dash?.widgets?.length ?? 0);
        if (this.DEBUG && dash) {
          dash.widgets.forEach(w =>
            this.log(`  widget #${w.id} "${w.config?.title}"`,
              'chart_data.length =', w.chart_data?.length ?? 0,
              'chart_type =', w.config?.chart_type,
              'dims =', w.config?.dimensions?.length,
              'measures =', w.config?.measures?.length)
          );
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // ------------------------------------------------------------------
  // Rename
  // ------------------------------------------------------------------

  enableRename(): void {
    this.renameTitle = this.dashboard?.title || '';
    this.isRenaming = true;
  }

  saveRename(): void {
    const newTitle = this.renameTitle.trim();
    if (newTitle && newTitle !== this.dashboard?.title) {
      this.dashboardService.updateDashboard(this.dashboardId, { title: newTitle })
        .subscribe({
          next: () => {
            if (this.dashboard) this.dashboard.title = newTitle;
            this.isRenaming = false;
            this.snackBar.open('Title updated', 'Close', { duration: 2000 });
          },
          error: () => {
            this.snackBar.open('Failed to update title', 'Close', { duration: 3000 });
          },
        });
    } else {
      this.isRenaming = false;
    }
  }

  cancelRename(): void {
    this.isRenaming = false;
    this.renameTitle = '';
  }

  // ------------------------------------------------------------------
  // Model selection (from left panel)
  // ------------------------------------------------------------------

  onModelSelected(model: DataModelOut): void {
    this.log('onModelSelected – model.id =', model.id, 'datasets =', model.datasets?.length);
    this.selectedModel = model;
    this.modelId = model.id;
    this.editorService.setDatasets(model.datasets);
  }

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------

  loadDashboard(): void {
    this.dashboardService.getDashboard(this.dashboardId).subscribe({
      next: (res) => {
        this.log('loadDashboard – received', res.widgets?.length ?? 0, 'widgets');
        this.dashboard = res;
        this.modelId = res.widgets?.[0]?.config?.model_id ?? null;
        this.log('inferred modelId =', this.modelId);

        this.editorService.setDashboard(res);
        this.loadModelMetadata(res);
        this.hydrateWidgets(res.widgets || []);
      },
      error: (err) => console.error('Failed to load dashboard', err),
    });
  }

  // ─── FIX 1: assign selectedModel so the editor knows which model is active ───
  loadModelMetadata(dashboard: DashboardResponse): void {
    const modelId = dashboard.widgets?.[0]?.config?.model_id ?? null;
    if (!modelId) {
      this.log('loadModelMetadata – no modelId, aborting');
      return;
    }

    this.log('loadModelMetadata – fetching model', modelId);
    this.dataModelService.getModel(modelId).subscribe({
      next: (model) => {
        this.log('loadModelMetadata – got model', model.id,
          'datasets =', model.datasets?.length);
        // ─── FIX 1 ───
        this.selectedModel = model;
        this.modelId = model.id;
        this.editorService.setDatasets(model.datasets);
      },
      error: (err: HttpErrorResponse) => {
        console.error('[DashboardEditor] Failed to load model metadata', err);
      },
    });
  }

  // ─── FIX 2: verbose hydrate + skip invalid widgets ───
 private hydrateWidgets(widgets: WidgetResponse[]): void {
  widgets.forEach(w => {
    const modelId = w.config?.model_id;
    const hasAxes =
      (w.config?.dimensions?.length ?? 0) > 0 ||
      (w.config?.measures?.length ?? 0) > 0;

    if (!modelId) {
      console.warn(`[hydrate] Widget ${w.id}: no model_id, skipping`);
      return;
    }
    if (!hasAxes) {
      console.warn(`[hydrate] Widget ${w.id}: no dims/measures, skipping`);
      return;
    }
    // ─── FIX 2a: server already hydrated this widget – leave it alone ───
    if (Array.isArray(w.chart_data) && w.chart_data.length > 0) {
      console.debug(
        `[hydrate] Widget ${w.id}: already has ${w.chart_data.length} rows`
      );
      return;
    }

    this.dashboardService.getWidgetData(modelId, w.config).subscribe({
      next: (res) => {
        const rows = res?.chart_data ?? [];
        if (rows.length === 0) {
          // ─── FIX 2b: make "empty but successful" visible ───
          console.warn(
            `[hydrate] Widget ${w.id}: backend returned 0 rows`,
            { modelId, config: w.config }
          );
        }
        this.editorService.updateWidgetLocally(w.id, { chart_data: rows });
      },
      error: (err) => {
        // ─── FIX 2c: log the real reason, not just "failed" ───
        console.error(
          `[hydrate] Widget ${w.id} failed:`,
          err?.error?.detail ?? err?.message ?? err
        );
      },
    });
  });
}

  // ------------------------------------------------------------------
  // Panel toggles
  // ------------------------------------------------------------------

  toggleLeft(): void { this.leftCollapsed = !this.leftCollapsed; }
  toggleRight(): void { this.rightCollapsed = !this.rightCollapsed; }

  // ------------------------------------------------------------------
  // Widget creation
  // ------------------------------------------------------------------

  private createDefaultWidgetConfig(model: DataModelOut): WidgetConfig | null {
    if (!model.datasets?.length) return null;

    const firstDataset = model.datasets[0];
    const datasetId = firstDataset.dataset_id;
    const columns = this.extractColumns(firstDataset.dataset);
    if (!columns.length) return null;

    const dimensionCol = columns[0];
    const measureCol = columns.find(c =>
      ['number', 'integer', 'float', 'int64', 'float64', 'int32', 'float32', 'decimal', 'numeric', 'double']
        .includes(c.type)
    ) || columns[0];

    return {
      model_id: this.modelId!,
      chart_type: 'bar',
      title: 'New Widget',
      dimensions: [{ dataset_id: datasetId, column: dimensionCol.name }],
      measures: [{
        dataset_id: datasetId,
        column: measureCol.name,
        aggregation: 'SUM',
        alias: null,
      }],
      filters: [],
      order_by: [],
      limit: null,
      color_scheme: 'default',
      missing_config: null,
    };
  }

  private extractColumns(dataset: any): { name: string; type: string }[] {
    if (!dataset) return [];
    const raw = dataset.column_schema;
    const refined = dataset.refined_column_schema;

    const typeLookup: Record<string, string> = {};
    if (refined && !Array.isArray(refined) && typeof refined === 'object') {
      Object.entries(refined).forEach(([n, info]: [string, any]) => {
        typeLookup[n] = this.getColumnType(typeof info === 'object' ? info : { type: info });
      });
    } else if (Array.isArray(refined)) {
      refined.forEach((c: any) => {
        if (c?.name) typeLookup[c.name] = this.getColumnType(c);
      });
    }

    const schema = raw || refined;
    if (!schema) return [];

    if (Array.isArray(schema)) {
      return schema
        .filter((c: any) => c?.name)
        .map((c: any) => ({
          name: c.name,
          type: typeLookup[c.name] ?? this.getColumnType(c),
        }));
    }

    if (typeof schema === 'object') {
      return Object.entries(schema)
        .filter(([name]) => !!name)
        .map(([name, info]: [string, any]) => ({
          name,
          type: typeLookup[name] ??
            this.getColumnType(typeof info === 'object' ? info : { type: info }),
        }));
    }
    return [];
  }

  private getColumnType(col: any): string {
    return String(col?.type || col?.dtype || col?.data_type || 'string').toLowerCase();
  }

  addNewWidget(): void {
    if (!this.selectedModel || !this.modelId) {
      this.log('addNewWidget – no selectedModel / modelId');
      this.snackBar.open('Please select a data model first', 'Close', { duration: 3000 });
      return;
    }

    const defaultConfig = this.createDefaultWidgetConfig(this.selectedModel);
    if (!defaultConfig) {
      this.snackBar.open(
        'Unable to create default widget: no columns found',
        'Close',
        { duration: 3000 }
      );
      return;
    }

    this.log('addNewWidget – creating with config', defaultConfig);

    this.editorService.addWidget(defaultConfig).subscribe({
      next: (created) => {
        this.log('addNewWidget – created widget', created.id,
          'chart_data =', created.chart_data?.length ?? 0);
        this.snackBar.open('Widget created', 'Close', { duration: 2000 });
      },
      error: (err) => {
        console.error('Failed to add widget', err);
        const errors = this.extractErrors(err);
        this.snackBar.open(
          'Cannot create widget: ' + errors.join(' • '),
          'Close',
          { duration: 6000 }
        );
      },
    });
  }

  private extractErrors(err: any): string[] {
    const detail = err?.error?.detail ?? err?.error ?? err?.message;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => (typeof d === 'string' ? d : d?.msg ?? JSON.stringify(d)));
    }
    if (detail && Array.isArray(detail.errors)) return detail.errors.map(String);
    if (typeof detail === 'string') return [detail];
    if (detail && typeof detail === 'object') return Object.values(detail).map(String);
    return ['Unknown error.'];
  }
}