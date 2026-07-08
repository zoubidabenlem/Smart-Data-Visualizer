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

import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DashboardsRoutingModule } from './dashboards-routing.module';
import { CreateDashboardDialogComponent } from './components/create-dashboard-dialog/create-dashboard-dialog.component';
import { DashboardListComponent } from './pages/dashboard-list/dashboard-list.component';
import { DashboardEditorService } from './services/dashboard-editor.service';
import { MatSelectModule } from '@angular/material/select';
import { DashboardEditorComponent } from './pages/dashboard-editor/dashboard-editor.component';
import { WidgetConfigDialogComponent } from './components/widget-config-dialog/widget-config-dialog.component';
import { GridsterModule } from 'angular-gridster2';
import { WidgetPopupComponent } from './components/widget-popup/widget-popup.component';
import { DashboardViewerComponent } from './pages/dashboard-viewer/dashboard-viewer.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { GridsterService } from './services/gridster.service';


@NgModule({
  declarations: [
    DashboardListComponent,
    CreateDashboardDialogComponent,
    DashboardEditorComponent,
    WidgetConfigDialogComponent,
    WidgetPopupComponent,
    DashboardViewerComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    GridsterModule,
    FormsModule,
    DashboardsRoutingModule,
   RouterModule,
    SharedModule,
  ],
  providers: [DashboardEditorService, GridsterService],
  
})
export class DashboardsModule { }
