import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardListComponent } from './pages/dashboard-list/dashboard-list.component';
import { DashboardEditorComponent } from './pages/dashboard-editor/dashboard-editor.component';

const routes: Routes = [
  {path:'', component: DashboardListComponent,       data: { title: 'Dashboard List' }    },
  {path: ':id/edit', component: DashboardEditorComponent,       data: { title: 'Dashboard Editor' }    },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardsRoutingModule { }
