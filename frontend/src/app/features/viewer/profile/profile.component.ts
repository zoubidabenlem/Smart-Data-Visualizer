import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from 'src/app/core/services/user.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { User } from 'src/app/core/models/user.model';

@Component({
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  user: any | null = null;
  loading = true;
// Simple mapping – adjust to match your DB roles
  roleNames: Record<number, string> = {
    1: 'Admin',
    2: 'Viewer',
    // add others as needed
  };
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
  this.userService.getCurrentUser().subscribe(profile => {
    this.user = profile;
    console.log(this.user);
    //{id: 4, email: 'viewertest2@example.com', role_id: 2, is_active: true}
    this.loading = false;
  });
}

    /** Helper to get the display role name */
   getRoleName(): string {
    if (!this.user) return '—';
    return this.roleNames[this.user.role_id] || `Role #${this.user.role_id}`;
  }


  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}