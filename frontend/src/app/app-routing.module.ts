import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadChildren: () =>
      import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'builder',
    loadChildren: () =>
      import('./features/builder/builder.module').then(m => m.BuilderModule)
  },
  {
    path: 'viewer',
    loadChildren: () =>
      import('./features/viewer/viewer.module').then(m => m.ViewerModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
