import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuilderComponent } from './builder.component';
import { PreviewModalComponent } from './preview-modal/preview-modal.component';
import { DatasetUploadComponent } from './dataset-upload/dataset-upload.component';
import { DatasetListComponent } from './dataset-list/dataset-list.component';
const routes: Routes = [
{ path: '', component: BuilderComponent },
  {path: 'preview/:id',component:PreviewModalComponent},
  {path: 'upload',component:DatasetUploadComponent},
  {path: 'datasets',component:DatasetListComponent},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BuilderRoutingModule { }
