import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ModelListComponent } from './model-list/model-list.component';
import { ModelCreateComponent } from './model-create/model-create.component';
import { ModelStudioComponent } from './model-studio/model-studio.component';
import { ModelDetailComponent } from './model-detail/model-detail.component';

const routes: Routes = [
  {
    path: '',
    component: ModelListComponent,   // Step 1
  },
  {
    path: 'new',
    component: ModelCreateComponent, // Step 2 (or use dialog)
  },
    { 
      path: ':id/studio',
       component: ModelStudioComponent 
      },   // <-- add this
  {
    path: ':id',
    component: ModelDetailComponent, // Step 3
  }

 
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ModelsRoutingModule { }
