import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatasetUploadComponent } from './dataset-upload.component';

describe('DatasetUploadComponent', () => {
  let component: DatasetUploadComponent;
  let fixture: ComponentFixture<DatasetUploadComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DatasetUploadComponent]
    });
    fixture = TestBed.createComponent(DatasetUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
