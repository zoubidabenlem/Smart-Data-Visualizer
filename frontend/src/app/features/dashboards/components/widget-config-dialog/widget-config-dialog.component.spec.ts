import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetConfigDialogComponent } from './widget-config-dialog.component';

describe('WidgetConfigDialogComponent', () => {
  let component: WidgetConfigDialogComponent;
  let fixture: ComponentFixture<WidgetConfigDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [WidgetConfigDialogComponent]
    });
    fixture = TestBed.createComponent(WidgetConfigDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
