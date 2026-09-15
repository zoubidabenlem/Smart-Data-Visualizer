// src/app/features/dashboards/components/widget-list/widget-list.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WidgetResponse } from 'src/app/core/models/dashboard.model';
import { DashboardEditorService } from '../../services/dashboard-editor.service';

@Component({
  selector: 'app-widget-list',
  templateUrl: './widget-list.component.html',
  styleUrls: ['./widget-list.component.css'],
})
export class WidgetListComponent {
  @Input() widgets: WidgetResponse[] = [];
  @Input() selectedWidgetId: number | null = null;
  @Output() widgetPicked = new EventEmitter<number>();

  collapsed = false;
  confirmingDeleteId: number | null = null;

  constructor(private editorService: DashboardEditorService) {}

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  trackByWidgetId = (_: number, w: WidgetResponse): number => w.id;

  pick(widgetId: number): void {
    if (this.confirmingDeleteId !== null) return;
    this.widgetPicked.emit(widgetId);
  }

  requestDelete(widgetId: number, event: Event): void {
    event.stopPropagation();
    this.confirmingDeleteId = widgetId;
  }

  confirmDelete(widgetId: number, event: Event): void {
    event.stopPropagation();
    this.confirmingDeleteId = null;
    this.editorService.deleteWidget(widgetId);
  }

  cancelDelete(event: Event): void {
    event.stopPropagation();
    this.confirmingDeleteId = null;
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
}