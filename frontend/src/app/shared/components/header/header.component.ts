import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from 'src/app/core/auth/auth.service';
import { User } from 'src/app/core/models/user.model';
import { HeaderTitleService } from 'src/app/core/services/header-title.service';  // adjust path

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  defaultTitle = 'Smart Data Visualizer';
  pageTitle$!: Observable<string>;
  private userSub?: Subscription;
  private titleSub?: Subscription;        // new

  constructor(
    private auth: AuthService,
    private headerTitle: HeaderTitleService,   // inject the service
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userSub = this.auth.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Subscribe to the dynamic title
    this.titleSub = this.headerTitle.currentTitle$.subscribe(title => {
    this.pageTitle$ = this.headerTitle.currentTitle$;
    });
  }

  get shouldShowWelcomeMessage(): boolean {
    const currentUrl = this.router.url || '';
    return !currentUrl.includes('/dashboards') && !currentUrl.includes('/builder/refine')  && !currentUrl.includes('/builder') && !currentUrl.includes('/admin/users') && !currentUrl.includes('/survey-requests')&& !currentUrl.includes('/');
  }

  logout(): void {
    this.auth.logout();
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.titleSub?.unsubscribe();   // clean up
  }
}