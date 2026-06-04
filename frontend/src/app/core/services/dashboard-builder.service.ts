import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { WidgetConfig, ChartType } from 'src/app/core/models/dashboard.model';

export interface BuilderWidget extends WidgetConfig {
  id: string;
  isNew?: boolean;
}

export interface DashboardBuilderState {
  dashboardId?: number;
  title: string;
  widgets: BuilderWidget[];
  activeWidgetId: string | null;
  datasetId: number | null;
  datasetColumns: string[];   // column names for dropdowns
}

const initialState: DashboardBuilderState = {
  title: '',
  widgets: [],
  activeWidgetId: null,
  datasetId: null,
  datasetColumns: [],
};

@Injectable({ providedIn: 'root' })
export class DashboardBuilderService {
  private state$ = new BehaviorSubject<DashboardBuilderState>(initialState);

  getState(): Observable<DashboardBuilderState> {
    return this.state$.asObservable();
  }

  getCurrentState(): DashboardBuilderState {
    return this.state$.getValue();
  }

  // Call this once when entering the builder (with datasetId from route)
  initDashboard(datasetId: number, columns: string[]): void {
    this.updateState({
      datasetId,
      datasetColumns: columns,
    });
  }

  setTitle(title: string): void {
    this.updateState({ title });
  }

  addWidget(chartType: ChartType): void {
    const current = this.getCurrentState();
    if (!current.datasetId) {
      console.error('No dataset ID – cannot add widget');
      return;
    }
    const newWidget: BuilderWidget = {
      id: uuidv4(),
      dataset_id: current.datasetId,
      chart_type: chartType,
      title: `New ${chartType.toUpperCase()}`,
      x_column: null,
      y_column: null,
      filters: [],
      group_by: null,
      agg_func: null,
      value_col: null,
      missing_config: null,
      color_scheme: 'default',
      isNew: true,
    };
    const widgets = [...current.widgets, newWidget];
    this.updateState({ widgets, activeWidgetId: newWidget.id });
  }

  removeWidget(widgetId: string): void {
    let widgets = this.getCurrentState().widgets.filter(w => w.id !== widgetId);
    let activeWidgetId = this.getCurrentState().activeWidgetId;
    if (activeWidgetId === widgetId) {
      activeWidgetId = widgets.length > 0 ? widgets[0].id : null;
    }
    this.updateState({ widgets, activeWidgetId });
  }

  setActiveWidget(widgetId: string | null): void {
    this.updateState({ activeWidgetId: widgetId });
  }

  updateWidget(widgetId: string, patch: Partial<WidgetConfig>): void {
    const widgets = this.getCurrentState().widgets.map(w =>
      w.id === widgetId ? { ...w, ...patch, isNew: false } : w
    );
    this.updateState({ widgets });
  }

  serializeForSave(): { title: string; widgets: WidgetConfig[] } {
    const state = this.getCurrentState();
    return {
      title: state.title,
      widgets: state.widgets.map(w => {
        const { id, isNew, ...config } = w;
        return config as WidgetConfig;
      }),
    };
  }

  reset(): void {
    this.updateState(initialState);
  }

  private updateState(patch: Partial<DashboardBuilderState>): void {
    const current = this.getCurrentState();
    this.state$.next({ ...current, ...patch });
  }
}