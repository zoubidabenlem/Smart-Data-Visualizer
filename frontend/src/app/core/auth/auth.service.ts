import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';   // <-- use named import for v4+
import { environment } from 'src/environments/environment';
import { User } from '../models/user.model';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
}

interface JwtPayload {
  user_id: number;
  role: string;
  exp?: number;
  // email?: string;   // if your backend includes it
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    const storedUser = localStorage.getItem(this.USER_KEY);
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
  return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password })
    .pipe(
      tap(response => {
        console.log('Login response:', response);
        this.setToken(response.access_token);
        const decoded = this.decodeToken(response.access_token);
        console.log('Decoded JWT payload:', decoded);
        
        // Extract role: prefer decoded.role, fallback to response.role
        const userRole = decoded.role || response.role;
        const userId = decoded.user_id || decoded.user_id || 0; // some backends use 'sub'
        
        console.log('Extracted user ID:', userId, 'Role:', userRole);
        
        const user: User = {
          id: userId,
          role: userRole,
        };
        console.log(' Setting user:', user);

        this.setUser(user);
      })
    );
}

  register(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, { email, password });
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private decodeToken(token: string): JwtPayload {
    try {
      return jwtDecode<JwtPayload>(token);
    } catch (error) {
      console.error('Invalid token', error);
      return { user_id: 0, role: 'guest' };
    }
  }

  private setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  getUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      // Check expiration if present
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  getRole(): string | null {
    return this.currentUserSubject.value?.role ?? null;
  }
}