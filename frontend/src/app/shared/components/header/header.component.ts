import { Component, OnDestroy } from '@angular/core';
import { AuthService } from 'src/app/core/auth/auth.service';
import { Subscription } from 'rxjs';
import { User } from 'src/app/core/models/user.model';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnDestroy {
  isLoggedIn = false;
  role: string | null = null;
  private userSubscription: Subscription;

  constructor(private auth: AuthService) {
    this.userSubscription = this.auth.currentUser$.subscribe((user: User | null) => {
      this.isLoggedIn = !!user;
      this.role = user?.role ?? null;
    });
  }

  logout() {
    this.auth.logout();
  }

  ngOnDestroy() {
    this.userSubscription.unsubscribe();
  }
}