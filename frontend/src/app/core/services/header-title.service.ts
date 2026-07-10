// header-title.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HeaderTitleService {
  // We keep track of the absolute base page context separately (e.g., 'Data Builder')
  private baseTitle: string = 'Smart Data Visualizer';
  
  private titleSource = new BehaviorSubject<string>('Smart Data Visualizer');
  currentTitle$ = this.titleSource.asObservable();

  /**
   * Use this for main top-level pages. Sets the base root text context.
   */
  setTitle(title: string) {
    this.baseTitle = title;
    this.titleSource.next(title);
  }

  /**
   * Call this when entering deep sub-workflow tabs, configurations, or views.
   * Automatically formats to: "Base Title / SUB-WORKFLOW"
   */
  appendSubTitle(subTitle: string) {
    const formattedSub = subTitle.trim();
    if (formattedSub) {
      this.titleSource.next(`${this.baseTitle} / ${formattedSub}`);
    } else {
      this.titleSource.next(this.baseTitle);
    }
  }

  /**
   * Resets the application header back to its clean parent context state.
   */
  resetToBase() {
    this.titleSource.next(this.baseTitle);
  }
}
