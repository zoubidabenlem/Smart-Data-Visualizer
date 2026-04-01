import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuilderRoutingModule } from './builder-routing.module';
import { Router, RouterModule, Routes } from '@angular/router';
import { DatasetSelectorComponent } from './dataset-selector/dataset-selector.component';
import { ColumnPickerComponent } from './column-picker/column-picker.component';
import { ChartTypeSelectorComponent } from './chart-type-selector/chart-type-selector.component';
import { FilterBuilderComponent } from './filter-builder/filter-builder.component';
import { AggregationComponent } from './aggregation/aggregation.component';
import { DashboardSaveComponent } from './dashboard-save/dashboard-save.component';
import { DatasetListComponent } from './dataset-list/dataset-list.component';
import { PreviewModalComponent } from './preview-modal/preview-modal.component';
import { DatasetUploadComponent } from './dataset-upload/dataset-upload.component';
import { BuilderComponent } from './builder.component';
@NgModule({
  declarations: [
    BuilderComponent,
    DatasetUploadComponent,
    DatasetListComponent,
    PreviewModalComponent,
    DatasetSelectorComponent,
    ColumnPickerComponent,
    ChartTypeSelectorComponent,
    FilterBuilderComponent,
    AggregationComponent,
    DashboardSaveComponent
  ],
  imports: [
    CommonModule,
    BuilderRoutingModule
  ]
})
export class BuilderModule { }
