import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data['roles'] as string[];

  const userRole = auth.getRole();
  const isLoggedIn = auth.isAuthenticated?.() ?? !!userRole;

  // Not logged in
  if (!isLoggedIn) {
    router.navigate(['/login']);
    return false;
  }

  // No roles required
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // Not authorized
  if (!userRole || !requiredRoles.includes(userRole)) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};