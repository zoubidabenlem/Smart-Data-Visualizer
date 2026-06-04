import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardBuilderPageComponent } from './dashboard-builder-page.component';

describe('DashboardBuilderPageComponent', () => {
  let component: DashboardBuilderPageComponent;
  let fixture: ComponentFixture<DashboardBuilderPageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DashboardBuilderPageComponent]
    });
    fixture = TestBed.createComponent(DashboardBuilderPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
