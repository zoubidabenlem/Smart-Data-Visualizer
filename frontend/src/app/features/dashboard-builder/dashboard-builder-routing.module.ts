import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardBuilderPageComponent } from './pages/dashboard-builder-page/dashboard-builder-page.component';

const routes: Routes = [
  { path: '', component: DashboardBuilderPageComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardBuilderRoutingModule { }
