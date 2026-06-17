// user-management.module.ts
import { NgModule } from '@angular/core';
import { UserManagementComponent } from './user-management.component';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AssignDashboardsDialogComponent } from './assign-dashboards-dialog/assign-dashboards-dialog.component';
import { MatDialogContent, MatDialogModule } from '@angular/material/dialog';
import { SharedModule } from 'src/app/shared/shared.module';

const routes: Routes = [
  { path: '', component: UserManagementComponent },
];

@NgModule({
 declarations: [
  UserManagementComponent,
   AssignDashboardsDialogComponent],  

  imports: [RouterModule.forChild(routes),
    CommonModule,
    ReactiveFormsModule,
    FormsModule , 
    MatDialogModule,
    SharedModule
  ],
  exports: [RouterModule]
})
export class UserManagementModule {}