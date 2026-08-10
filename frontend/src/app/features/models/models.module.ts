import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ModelsRoutingModule } from './models-routing.module';
import { ModelListComponent } from './model-list/model-list.component';
import { ModelCreateComponent } from './model-create/model-create.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDialogModule } from '@angular/material/dialog';


@NgModule({
  declarations: [
    ModelListComponent,
    ModelCreateComponent
  ],
  imports: [
    CommonModule,
    ModelsRoutingModule, 
    FormsModule,
    ReactiveFormsModule,
    MatPaginatorModule,
    MatDialogModule
    
  ]
})
export class ModelsModule { }
