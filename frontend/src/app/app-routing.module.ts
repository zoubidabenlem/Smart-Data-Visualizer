import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { BuilderModule } from './features/builder/builder.module';
const routes: Routes = [
  // Landing page (public)
  { path: '', loadChildren: () => import('./features/landing/landing.module').then(m => m.LandingModule) },

  // Login (public)
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  // Builder route — protected by BOTH guards, run in order
  {
  path: 'builder',
  canActivate: [authGuard, roleGuard],
  data: { roles: ['admin'] },
  loadChildren: () => import('./features/builder/builder.module').then(m => m.BuilderModule)
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
