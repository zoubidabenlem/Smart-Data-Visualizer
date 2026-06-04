import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { DashboardBuilderRoutingModule } from './dashboard-builder-routing.module';
import { DashboardBuilderPageComponent } from './pages/dashboard-builder-page/dashboard-builder-page.component';
import { DatasetSelectorComponent } from './components/dataset-selector/dataset-selector.component';


@NgModule({
  declarations: [
    DashboardBuilderPageComponent,
    DatasetSelectorComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DashboardBuilderRoutingModule,
    MatExpansionModule,
    MatMenuModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatInputModule,
    MatButtonToggleModule,
    MatCardModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ]
})
export class DashboardBuilderModule { }