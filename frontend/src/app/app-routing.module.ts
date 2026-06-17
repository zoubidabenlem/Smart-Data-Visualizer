import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

import { UnauthorizedComponent } from './core/unauthorized/unauthorized.component';
import { DashboardViewerComponent } from './features/dashboards/pages/dashboard-viewer/dashboard-viewer.component';
const routes: Routes = [
  // Landing page (public)
  { path: '', loadChildren: () => import('./features/landing/landing.module').then(m => m.LandingModule) },

  // Login (public)
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  //Register (public)
  // Builder route — protected by BOTH guards, run in order
  {
  path: 'builder',
  canActivate: [authGuard, roleGuard],
  data: { roles: ['admin'] },
  loadChildren: () => import('./features/builder/builder.module').then(m => m.BuilderModule)
},
///////////////DASHBOARD  routes — protected by BOTH guards, run in order
  {
  path: 'dashboards',
  canActivate: [authGuard, roleGuard],
  data: { roles: ['admin'] },
  loadChildren: () => import('./features/dashboards/dashboards.module').then(m => m.DashboardsModule)
},
/// user management route — protected by BOTH guards, run in order
  {
  path: 'admin/users',
  canActivate: [authGuard, roleGuard],
  data: { roles: ['admin'] },
  loadChildren: () => import('./features/user-management/user-management.module')
                           .then(m => m.UserManagementModule)
},
  // Viewer route — protected by AuthGuard
  {
    path: 'viewer',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/viewer/viewer.module').then(m => m.ViewerModule)
  },

{ path: 'unauthorized', component: UnauthorizedComponent },
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
