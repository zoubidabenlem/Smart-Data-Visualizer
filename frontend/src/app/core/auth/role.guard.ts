import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { jwtDecode } from 'jwt-decode';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data['roles'] as string[];
  
  // 1️⃣ Check authentication first
  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // 2️⃣ If no roles are required, allow access
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // 3️⃣ Get role directly from the token (most reliable)
  let userRole: string | null = null;
  const token = auth.getToken();
  if (token) {
    try {
      const decoded: any = jwtDecode(token);
      userRole = decoded.role || decoded.roles?.[0] || null;
      console.log('RoleGuard: role from token =', userRole);
    } catch (err) {
      console.error('RoleGuard: failed to decode token', err);
    }
  }

  // Fallback to AuthService's stored role (in case token decode fails)
  if (!userRole) {
    userRole = auth.getRole();
    console.log('RoleGuard: role from service =', userRole);
  }

  // 4️⃣ Authorize
  if (!userRole || !requiredRoles.includes(userRole)) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};