import { Component, Input, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';
import { Default } from '../../../core/models/dashboard.model';

@Component({
  selector: 'app-title-advanced-step',
  templateUrl: './title-advanced-step.component.html',
  styleUrls: ['./title-advanced-step.component.css']
})
export class TitleAdvancedStepComponent implements OnInit {
  @Input() form!: FormGroup;
  @Input() columns: { name: string; type: string }[] = [];

  missingDefaults: Default[] = ['drop', 'fill', 'mean'];//add mode median min max and kpi to backend and regenerate contract
  showAdvanced = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    // Ensure the missing_config group exists
    if (!this.form.get('missing_config')) {
      this.form.addControl('missing_config', this.fb.group({
        default: ['drop'],
        default_fill_value: [null],
        overrides: this.fb.array([])
      }));
    }
  }

  get overridesArray(): FormArray {
    return this.form.get('missing_config.overrides') as FormArray;
  }

  addOverride(): void {
    this.overridesArray.push(this.fb.group({
      column: [null],
      strategy: ['drop'],
      fill_value: [null]
    }));
  }

  removeOverride(index: number): void {
    this.overridesArray.removeAt(index);
  }
}