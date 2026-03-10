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
   onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.isLoading = false;
        // Route based on role
        this.router.navigate([res.role === 'admin' ? '/builder' : '/viewer']);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          this.errorMessage = 'Incorrect email or password.';
        } else if (err.status === 403) {
          this.errorMessage = 'Account is disabled. Contact your administrator.';
        } else if (err.status === 0) {
          this.errorMessage = 'Cannot reach the server. Is the API running?';
        } else {
          this.errorMessage = `Unexpected error (${err.status}). Check the console.`;
        }
      }
    });
  }

  // Getter shortcuts so the template can access form controls cleanly.
  get email(){return this.loginForm.get('email');}
  get password(){return this.loginForm.get('password');}
}
