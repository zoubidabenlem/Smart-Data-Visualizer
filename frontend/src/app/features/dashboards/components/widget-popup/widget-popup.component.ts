import { Component, Inject, ViewChild, AfterViewInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { WidgetResponse } from 'src/app/core/models/dashboard.model';
import { WidgetChartComponent } from 'src/app/shared/components/widget-chart/widget-chart.component';

@Component({
  selector: 'app-widget-popup',
  templateUrl: './widget-popup.component.html',
  styleUrls: ['./widget-popup.component.css']
})
export class WidgetPopupComponent implements AfterViewInit {
  @ViewChild(WidgetChartComponent) chartComponent!: WidgetChartComponent;
  widget: WidgetResponse;

  constructor(
    public dialogRef: MatDialogRef<WidgetPopupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { widget: WidgetResponse }
  ) {
    this.widget = data.widget;
  }

  ngAfterViewInit(): void {
    // Wait for the browser to finish laying out the dialog's flex containers
    requestAnimationFrame(() => {
      this.chartComponent?.resizeChart();
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}