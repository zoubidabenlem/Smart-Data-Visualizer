import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuilderRoutingModule } from './builder-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, Routes } from '@angular/router';
import { ColumnPickerComponent } from './column-picker/column-picker.component';

import { DatasetListComponent } from './dataset-list/dataset-list.component';
import { PreviewModalComponent } from './preview-modal/preview-modal.component';
import { DatasetUploadComponent } from './dataset-upload/dataset-upload.component';
import { BuilderComponent } from './builder.component';
import { SchemaRefineComponent } from './refine-schema/refine-schema.component';

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
    ColumnPickerComponent,
    ColumnPickerComponent,
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
  ],
})
export class BuilderModule { }
