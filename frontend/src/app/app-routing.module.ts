import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

const routes: Routes = [
    // Default route
  { path: '', redirectTo: 'login', pathMatch: 'full' },
    // Login route — no guards, publicly accessible.
  // Lazy loads AuthModule which internally renders LoginComponent at path ''.
  {
    path: 'login',
    loadChildren: () =>
      import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  // Builder route — protected by BOTH guards, run in order
  {
    path: 'builder',
    canActivate: [authGuard, roleGuard],
    loadChildren: () =>
      import('./features/builder/builder.module').then(m => m.BuilderModule)
  },
  // Viewer route — protected by AuthGuard
  {
    path: 'viewer',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/viewer/viewer.module').then(m => m.ViewerModule)
  },


  // Wildcard route — catches any URL that didn't match above.
  // Always put this last — the router matches top to bottom
  // and a wildcard at the top would swallow every route.
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
