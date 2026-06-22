import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuilderRoutingModule } from './builder-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { ScrollingModule } from '@angular/cdk/scrolling';

// Angular Material Imports
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

// Shared Module
import { SharedModule } from 'src/app/shared/shared.module';

// Feature Components
import { BuilderComponent } from './builder.component';
import { DatasetUploadComponent } from './dataset-upload/dataset-upload.component';
import { ConfigureHeaderComponent } from './configure-header/configure-header.component';
import { DatasetListComponent } from './dataset-list/dataset-list.component';
import { PreviewModalComponent } from './preview-modal/preview-modal.component';
import { SchemaRefineComponent } from './refine-schema/refine-schema.component';
import { ColumnPickerComponent } from './column-picker/column-picker.component';

@NgModule({
  declarations: [
    BuilderComponent,
    DatasetUploadComponent,
    ConfigureHeaderComponent,
    DatasetListComponent,
    PreviewModalComponent,
    SchemaRefineComponent,
    ColumnPickerComponent,
    ColumnPickerComponent,
    ConfigureHeaderComponent,
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
    ScrollingModule,
    SharedModule,],
})
export class BuilderModule { }
