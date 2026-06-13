import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { WidgetResponse } from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-widget-popup',
  templateUrl: './widget-popup.component.html',
  styleUrls: ['./widget-popup.component.css']
   
})
export class WidgetPopupComponent {
  widget: WidgetResponse;

  constructor(
    public dialogRef: MatDialogRef<WidgetPopupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { widget: WidgetResponse }
  ) {
    this.widget = data.widget;
  }

  close(): void {
    this.dialogRef.close();
  }
}