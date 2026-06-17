import { Component } from '@angular/core';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Smart Data Visualizer';
  constructor(private auth: AuthService) {
    this.auth.currentUser$.subscribe(user => {
      console.log(`[AppComponent] user:`, user);
    });
  }
}
