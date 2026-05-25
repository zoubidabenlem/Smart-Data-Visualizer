import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuilderRoutingModule } from './builder-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { SchemaRefineComponent } from './refine-schema/refine-schema.component';
import { DashboardBuilderComponent } from '../dashboard-builder/dashboard-builder.component';
import { TitleAdvancedStepComponent } from '../dashboard-builder/title-advanced-step/title-advanced-step.component';
import { AggregationStepComponent } from '../dashboard-builder/aggregation-step/aggregation-step.component';
import { FiltersStepComponent } from '../dashboard-builder/filters-step/filters-step.component';
import { ChartTypeStepComponent } from '../dashboard-builder/chart-type-step/chart-type-step.component';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { OverlayModule } from '@angular/cdk/overlay';
import { ScrollingModule } from '@angular/cdk/scrolling';
@NgModule({
  declarations: [
    BuilderComponent,
    DatasetUploadComponent,
    DatasetListComponent,
    PreviewModalComponent,
    SchemaRefineComponent,
    DashboardBuilderComponent, 
    ColumnPickerComponent,
    DatasetSelectorComponent,
    ColumnPickerComponent,
    ChartTypeSelectorComponent,
    FilterBuilderComponent,
    AggregationComponent,
    DashboardSaveComponent,
    ChartTypeStepComponent,
    FiltersStepComponent,
    AggregationStepComponent,
    TitleAdvancedStepComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    BuilderRoutingModule,
    MatStepperModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    OverlayModule,
    ScrollingModule
  ]
})
export class BuilderModule { }
