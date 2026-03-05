import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BuilderRoutingModule } from './builder-routing.module';
import { DatasetSelectorComponent } from './dataset-selector/dataset-selector.component';
import { ColumnPickerComponent } from './column-picker/column-picker.component';
import { ChartTypeSelectorComponent } from './chart-type-selector/chart-type-selector.component';
import { FilterBuilderComponent } from './filter-builder/filter-builder.component';
import { AggregationComponent } from './aggregation/aggregation.component';
import { DashboardSaveComponent } from './dashboard-save/dashboard-save.component';


@NgModule({
  declarations: [
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
