import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

//Injectable has no root , since interceptors are different , they're registeres in appModule providers
@Injectable()
export class JwtInterceptor implements HttpInterceptor {

  constructor(private auth: AuthService) {}
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();
    if (token){
      //create copy if token exists every reuqest get the header 
      request= request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        } 
      });
    }
    //login request goes out as-is. 
    return next.handle(request);
  }
}
