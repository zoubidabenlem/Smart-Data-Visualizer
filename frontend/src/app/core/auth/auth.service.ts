import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

//Interfaces to describe data in and out the api
export interface LoginRequest{
  email:string;
  password: string;
}

export interface LoginResponse{
  access_token:string;
  token_type:string;
  role:string;
}

//Service for authentication : this class can be injectable (provided in root = one instance)
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  //only auth service can setwrite /set  the token(through login)
  private readonly API_URL = 'http://localhost:8080/';
  private token: string | null = null;
  private role: string | null = null;

  // Angular injects HttpClient here automatically because of @Injectable above.
  constructor(private httpp: HttpClient) { }

  //login function
  login(credentials: LoginRequest):Observable<LoginResponse>{
    return this.httpp
      .post<LoginResponse>('${this.API_URL}/login', credentials)
      .pipe(
        //tap() is an operator that lets you run a side effect (storing the token) when the Observable emits, without interfering with what the subscriber receives. 
        tap(response =>{
          this.token = response.access_token;
          this.role = response.role;
        })
      );
  }

  //logout function
  logout():void{
    this.token = null;
    this.role = null;
  }
  //Retrieve the token
  getToken(): string | null {
    return this.token;
  }
  //retrieve the role
  getRole(): string | null {
    return this.role;
  }
  //method to check if the user is authenticated
  isAuthenticated(): boolean {
    return !!this.token;
  }
}
