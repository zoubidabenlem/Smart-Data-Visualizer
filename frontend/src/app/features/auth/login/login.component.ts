import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';
@Component({
  //html tag name for this component
  selector: 'app-login',
  //html template
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  //properties for state
  isLoading = false;
  errorMessage = '';
//login form holds the form values, states, validity
  loginForm:FormGroup;
  constructor(
    private fb : FormBuilder,//creats formgroup objects
    private router : Router,//calls backend login endpoint
    private auth : AuthService //naviagte after succesful login
  ) {
    //Build the form inside the constructor each key is a form field 
    this.loginForm=this.fb.group({
      email:['', [Validators.required, Validators.email]],
      password:['',[Validators.required, Validators.minLength(6)]]
    });
  }
  onSubmit():void{
    //safety check  if form is invalid do nothing and mark fields as touched for validator mssgs
    if(this.loginForm.invalid){
      this.loginForm.markAllAsTouched();
      return;
    }
    // show loading state and clear errmssg
    this.isLoading=true;
    this.errorMessage='';
    
    // auth.login creates observable , Angular needs to subsicrbe to send request
    this.auth.login(this.loginForm.value).subscribe({
      //next runs when the backend responds succesfully (token stored in auth service)
      next: (response)=>{
        this.isLoading=false;
        if(response.role === 'admin'){
          this.router.navigate(['/builder']);
        }else{
          this.router.navigate(['/viewer']);
        }
      },
      // error() runs when the backend returns an error response.
      error: (err)=>{
        this.isLoading=false;
        if(err.status === 401){
          this.errorMessage='UNAUTHORIZED: Invalid email or password';
        } else if(err.status===0){
          this.errorMessage='NO RESPONSE FROM SERVER';
        }else{
          this.errorMessage='UNKNOWN ERROR: Something went wrong';
        } 
      }
    });
  }
  // Getter shortcuts so the template can access form controls cleanly.
  get email(){return this.loginForm.get('email');}
  get password(){return this.loginForm.get('password');}
}
