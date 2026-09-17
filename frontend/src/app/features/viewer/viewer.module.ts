import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ViewerRoutingModule } from './viewer-routing.module';
import { DashboardListComponent } from './dashboard-list/dashboard-list.component';
import { DashboardViewComponent } from './dashboard-view/dashboard-view.component';
import { ProfileComponent } from './profile/profile.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { GridsterModule } from 'angular-gridster2';
import { WidgetChartComponent } from 'src/app/shared/components/widget-chart/widget-chart.component';
import { ViewerFilterChipComponent } from './dashboard-view/components/viewer-filter-chip/viewer-filter-chip.component';

@NgModule({
  declarations: [
    DashboardListComponent,
    DashboardViewComponent,
    ProfileComponent,
    ViewerFilterChipComponent,
  ],
    imports: [
    CommonModule,
    ViewerRoutingModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    GridsterModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    WidgetChartComponent,
  ],
})
export class ViewerModule { }
