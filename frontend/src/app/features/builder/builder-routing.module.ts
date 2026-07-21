import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuilderComponent } from './builder.component';
import { PreviewModalComponent } from './preview-modal/preview-modal.component';
import { DatasetUploadComponent } from './dataset-upload/dataset-upload.component';
import { DatasetListComponent } from './dataset-list/dataset-list.component';
import { authGuard } from 'src/app/core/auth/auth.guard';
import { roleGuard } from 'src/app/core/auth/role.guard';
import { RefineGuard } from 'src/app/core/guards/refine.guard';
import { ConfigureHeaderComponent } from './configure-header/configure-header.component';
import { RefineSandboxComponent } from './refine-sandbox/refine-sandbox.component';
import { MySQLConnectionsComponent } from './mysql-connections/mysql-connections.component';
import { TableExplorerComponent } from './mysql-connections/table-explorer/table-explorer.component';
const routes: Routes = [
{ 
  path: '',
   component: BuilderComponent,
   data: { title: 'Data Builder' }        // will show "Builder" in the header

   },
  {path: 'preview/:id',component:PreviewModalComponent},
  {path: 'upload',component:DatasetUploadComponent},
  {path: 'datasets',component:DatasetListComponent},
  { 
    path: 'configure-header/:id', 
    component: ConfigureHeaderComponent ,
           data: { title: 'Configure Header' }        // will show "Builder" in the header

  },
  {
    path: 'refine/:datasetId',
    component: RefineSandboxComponent,
       data: { title: 'Data Refinement' }        // will show "Builder" in the header

  },
  // ---------- new MySQL routes ----------
  { path: 'mysql-connections', component: MySQLConnectionsComponent, data: { title: 'MySQL Connections' } },
  { path: 'mysql-connections/:id/explore', component: TableExplorerComponent, data: { title: 'Explore MySQL Tables' } }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BuilderRoutingModule { }
