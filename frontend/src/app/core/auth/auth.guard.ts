import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { inject } from '@angular/core';


export const authGuard: CanActivateFn = () => {
  const auth=inject(AuthService);
  const router=inject(Router);

  if(auth.isAuthenticated()){
      // Token exists in memory
    return true;
  }
  router.navigate(['login']);
  return false; //naviagte to login and  block original navigateion
};
