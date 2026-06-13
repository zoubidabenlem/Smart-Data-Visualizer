import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardListComponent } from './pages/dashboard-list/dashboard-list.component';
import { DashboardEditorComponent } from './pages/dashboard-editor/dashboard-editor.component';
import { DashboardViewerComponent } from './pages/dashboard-viewer/dashboard-viewer.component';

const routes: Routes = [
  {path:'', component: DashboardListComponent},
  {path: ':id/edit', component: DashboardEditorComponent},
  {path: 'view/:id', component: DashboardViewerComponent},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardsRoutingModule { }
