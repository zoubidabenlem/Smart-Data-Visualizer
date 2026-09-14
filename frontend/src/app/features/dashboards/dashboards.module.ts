import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';


import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ReactiveFormsModule, FormsModule, FormGroup } from '@angular/forms';
import { DashboardsRoutingModule } from './dashboards-routing.module';
import { DashboardListComponent } from './pages/dashboard-list/dashboard-list.component';
import { DashboardEditorService } from './services/dashboard-editor.service';
import { MatSelectModule } from '@angular/material/select';
import { DashboardEditorComponent } from './pages/dashboard-editor/dashboard-editor.component';
import { GridsterModule } from 'angular-gridster2';
import { SharedModule } from 'src/app/shared/shared.module';
import { GridsterService } from './services/gridster.service';
import { DataModelExplorerComponent } from './components/data-model-explorer/data-model-explorer.component';
import { WidgetConfigPanelComponent } from './components/widget-config-panel/widget-config-panel.component';
import { CenterCanvasComponent } from './components/center-canvas/center-canvas.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ModelPickerComponent } from './components/model-picker/model-picker.component';
import { ModelMetadataComponent } from './components/model-metadata/model-metadata.component';

@NgModule({
  declarations: [
    DashboardListComponent,
    DashboardEditorComponent,
    DataModelExplorerComponent,
    WidgetConfigPanelComponent,
    CenterCanvasComponent,
    ModelPickerComponent,
    ModelMetadataComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    GridsterModule,
    FormsModule,
    MatExpansionModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatListModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    DashboardsRoutingModule,
   RouterModule,
    SharedModule,
  ],
  providers: [DashboardEditorService, GridsterService],
  exports: []
  
})
export class DashboardsModule { }
