import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if(auth.getRole() == 'admin') {
    router.navigate(['/builder']);
    return true;
  }
  // Viewer trying to access /builder → send to /viewer
  return router.createUrlTree(['/viewer']);
};
