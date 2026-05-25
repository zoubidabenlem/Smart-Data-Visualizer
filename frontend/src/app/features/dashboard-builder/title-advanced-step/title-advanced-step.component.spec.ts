import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TitleAdvancedStepComponent } from './title-advanced-step.component';

describe('TitleAdvancedStepComponent', () => {
  let component: TitleAdvancedStepComponent;
  let fixture: ComponentFixture<TitleAdvancedStepComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TitleAdvancedStepComponent]
    });
    fixture = TestBed.createComponent(TitleAdvancedStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
