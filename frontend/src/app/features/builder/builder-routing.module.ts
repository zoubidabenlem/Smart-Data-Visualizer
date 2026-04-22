import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuilderComponent } from './builder.component';
import { PreviewModalComponent } from './preview-modal/preview-modal.component';
import { DatasetUploadComponent } from './dataset-upload/dataset-upload.component';
import { DatasetListComponent } from './dataset-list/dataset-list.component';
import { SchemaRefineComponent } from './refine-schema/refine-schema.component';
import { ColumnPickerComponent } from './column-picker/column-picker.component';
import { authGuard } from 'src/app/core/auth/auth.guard';
import { roleGuard } from 'src/app/core/auth/role.guard';
import { RefineGuard } from 'src/app/core/guards/refine.guard';
const routes: Routes = [
{ path: '', component: BuilderComponent },
  {path: 'preview/:id',component:PreviewModalComponent},
  {path: 'upload',component:DatasetUploadComponent},
  {path: 'datasets',component:DatasetListComponent},
  { path: 'refine/:datasetId', component: SchemaRefineComponent }   ,
  {
    path: 'refine/:datasetId',
    component: SchemaRefineComponent,
    canActivate: [authGuard, roleGuard, RefineGuard],   // add RefineGuard here
    data: { role: 'admin' }
  },
  { path: 'columns/:datasetId', component: ColumnPickerComponent }  


];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BuilderRoutingModule { }
