import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AuthService } from 'src/app/core/auth/auth.service';
import { User } from 'src/app/core/models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  private userSub?: Subscription;

  constructor(
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {  console.log('HeaderComponent CONSTRUCTOR');
}

  ngOnInit(): void {
    console.log('HeaderComponent ngOnInit - subscribing');
  this.userSub = this.auth.currentUser$.subscribe(user => {
    console.log('Header received user:', user);
    this.currentUser = user;
  });
  }

  logout(): void {
    this.auth.logout();
  }

  ngOnDestroy(): void {
    console.log('HeaderComponent DESTROYED');

    this.userSub?.unsubscribe();

  }
}