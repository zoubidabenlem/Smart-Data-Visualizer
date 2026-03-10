import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './login/login.component';
//import { RegisterComponent } from './register/register.component';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from 'src/app/core/auth/auth.service';
const routes: Routes = [
  //no /login  :AppRoutingModule already handles the 'login' prefix. This module only needs to know what to render at the root of its own path
  {path: '',component:LoginComponent},
]
@NgModule({
   // Every component that belongs to this module must be declared here.
  declarations: [
    LoginComponent,
    //RegisterComponent
  ],
  imports: [
    CommonModule,   // *ngIf, *ngFor, async pipe, etc.
    HttpClientModule, // HttpClient (used by AuthService)
    RouterModule.forChild(routes), // for child is called every feauture module, registers additional routes without creating a new router instance
    ReactiveFormsModule  // FormGroup, FormControl, Validators
  ],
  providers: [AuthService]  // <-- ADD?
})
export class AuthModule { }
