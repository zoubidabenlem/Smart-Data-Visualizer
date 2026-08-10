import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ModelListComponent } from './model-list/model-list.component';
import { ModelCreateComponent } from './model-create/model-create.component';

const routes: Routes = [
  {
    path: '',
    component: ModelListComponent,   // Step 1
  },
  {
    path: 'new',
    component: ModelCreateComponent, // Step 2 (or use dialog)
  },
 
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ModelsRoutingModule { }
