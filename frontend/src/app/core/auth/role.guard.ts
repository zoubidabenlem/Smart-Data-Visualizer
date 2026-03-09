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
  
  // User is authenticated but not an admin
  return router.navigate(['/viewer']);
};
