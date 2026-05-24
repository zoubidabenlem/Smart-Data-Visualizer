import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardBuilderComponent } from './dashboard-builder.component';

describe('DashboardBuilderComponent', () => {
  let component: DashboardBuilderComponent;
  let fixture: ComponentFixture<DashboardBuilderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DashboardBuilderComponent]
    });
    fixture = TestBed.createComponent(DashboardBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
