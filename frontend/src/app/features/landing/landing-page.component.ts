import { Component } from '@angular/core';
import { HeaderTitleService } from 'src/app/core/services/header-title.service';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css']
})
export class LandingPageComponent {
  constructor(headerTitle: HeaderTitleService) {
    headerTitle.setTitle('Home');
  }

}

