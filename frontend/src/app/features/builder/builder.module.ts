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
import { RefineService } from 'src/app/core/services/refine.service';
import { RefineSandboxComponent } from './refine-sandbox/refine-sandbox.component';
import { ConnectionFormComponent } from './mysql-connections/connection-form/connection-form.component';
import { TableExplorerComponent } from './mysql-connections/table-explorer/table-explorer.component';
import { ImportDialogComponent } from './mysql-connections/import-dialog/import-dialog.component';
import { MySQLConnectionsComponent } from './mysql-connections/mysql-connections.component';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';

@NgModule({
  declarations: [
    BuilderComponent,
    DatasetUploadComponent,
    ConfigureHeaderComponent,
    DatasetListComponent,
    PreviewModalComponent,
    ConfigureHeaderComponent,
    RefineSandboxComponent,
    MySQLConnectionsComponent,
    ConnectionFormComponent,
    TableExplorerComponent,
    ImportDialogComponent,
  ],
  imports: [
    CommonModule,
    MatExpansionModule,
    ReactiveFormsModule,
    FormsModule,
    BuilderRoutingModule,
    MatStepperModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    OverlayModule,
    ScrollingModule,
    SharedModule,
  ],
  providers: [RefineService],
})
export class BuilderModule { }
