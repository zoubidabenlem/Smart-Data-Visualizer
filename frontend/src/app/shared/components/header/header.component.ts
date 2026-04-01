import { Component } from '@angular/core';
import { AuthService } from 'src/app/core/auth/auth.service';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
// header.component.ts
export class HeaderComponent {
  isLoggedIn = false;
  role: string | null = null;

  constructor(private auth: AuthService) {
    this.isLoggedIn = this.auth.isAuthenticated();
    this.role = this.auth.getRole();
  }

  logout() {
    this.auth.logout();
    // redirect to login
  }
}