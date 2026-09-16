import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard as AuthGuard } from 'src/app/core/auth/auth.guard';
import { DashboardListComponent } from './dashboard-list/dashboard-list.component';
import { DashboardViewComponent } from './dashboard-view/dashboard-view.component';
import { ProfileComponent } from './profile/profile.component';

const routes: Routes = [
  {
    path: 'dashboards',
    component: DashboardListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'dashboards/:id',
    component: DashboardViewComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [AuthGuard]
  },
  { path: '', redirectTo: 'dashboards', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes) ],
  exports: [RouterModule]
})
export class ViewerRoutingModule {}