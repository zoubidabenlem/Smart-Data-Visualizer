import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ViewerRoutingModule } from './viewer-routing.module';
import { DashboardListComponent } from './dashboard-list/dashboard-list.component';
import { DashboardViewComponent } from './dashboard-view/dashboard-view.component';
import { ProfileComponent } from './profile/profile.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { GridsterService } from '../dashboards/services/gridster.service';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { GridsterModule } from 'angular-gridster2';

@NgModule({
  declarations: [
    DashboardListComponent,
    DashboardViewComponent,
    ProfileComponent,
  ],
  imports: [
    CommonModule,
    ViewerRoutingModule,
    RouterModule,
   SharedModule,
   DashboardsModule,
     RouterModule,
  GridsterModule,          // ← NEW, required
  MatIconModule,
  MatButtonModule,
  MatProgressBarModule,
  MatProgressSpinnerModule,
  MatFormFieldModule,
  MatInputModule,
  MatSelectModule,
  SharedModule,            // ← for app-widget-chart
  ViewerRoutingModule,

  ]
})
export class ViewerModule { }
