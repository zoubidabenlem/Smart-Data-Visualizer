import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatasetSelectorComponent } from './dataset-selector.component';

describe('DatasetSelectorComponent', () => {
  let component: DatasetSelectorComponent;
  let fixture: ComponentFixture<DatasetSelectorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DatasetSelectorComponent]
    });
    fixture = TestBed.createComponent(DatasetSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
