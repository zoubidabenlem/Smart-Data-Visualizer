import { Component, Input } from '@angular/core';
import { FormGroup, FormArray } from '@angular/forms';
import { DashboardBuilderStateService } from '../../../core/services/dashboard-builder-state.service';
import { Operator } from '../../../core/models/dashboard.model';

@Component({
  selector: 'app-filters-step',
  templateUrl: './filters-step.component.html',
  styleUrls: ['./filters-step.component.css']
})
export class FiltersStepComponent {
  @Input() form!: FormGroup;
  @Input() columns: { name: string; type: string }[] = [];

  operators: Operator[] = ['==', '!=', '>', '<', 'in', 'like'];

  constructor(private state: DashboardBuilderStateService) {}

  get filtersArray(): FormArray {
    return this.form.get('filters') as FormArray;
  }

  addFilter(): void {
    this.state.addFilter(); // uses state service's method to push a new filter group
  }

  removeFilter(index: number): void {
    this.state.removeFilter(index);
  }

  isOperatorMulti(operator: string): boolean {
    return operator === 'in';
  }

  isOperatorText(operator: string): boolean {
    return operator === 'like';
  }
}