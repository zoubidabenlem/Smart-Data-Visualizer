import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-survey',
  templateUrl: './survey.component.html',
  styleUrls: ['./survey.component.css']
})
export class SurveyComponent {
  surveyForm: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
    this.surveyForm = this.fb.group({
      business_email: ['', [Validators.required, Validators.email]],
      contact_name: [''],
      company_name: [''],
      data_description: ['', Validators.required],
    });
  }

  onSubmit(): void {
    if (this.surveyForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = this.surveyForm.value;
    this.http.post(`${environment.apiUrl}/survey/submit`, payload)
      .subscribe({
        next: () => {
          this.successMessage = 'Thank you! We will contact you soon.';
          this.surveyForm.reset();
          this.isLoading = false;
          this.router.navigate(['/admin/users']);
          },
        error: () => {
          this.errorMessage = 'Something went wrong. Please try again.';
          this.isLoading = false;
        }
      });
  }
}