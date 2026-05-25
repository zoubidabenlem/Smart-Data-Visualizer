import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AggFunc } from '../../../core/models/dashboard.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-aggregation-step',
  templateUrl: './aggregation-step.component.html',
  styleUrls: ['./aggregation-step.component.css']
})
export class AggregationStepComponent implements OnInit, OnDestroy {
  @Input() form!: FormGroup;
  @Input() columns: { name: string; type: string }[] = [];

  numericColumns: { name: string; type: string }[] = [];
  aggFunctions: (AggFunc | null)[] = [null, 'SUM', 'MEAN', 'COUNT', ]; //add min max to bakend and regenrate contract 
  showAggregation = false;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.numericColumns = this.columns.filter(c => 
      c.type === 'number' || c.type === 'integer' || c.type === 'float'
    );
    this.form.get('agg_func')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(aggFunc => {
        this.showAggregation = aggFunc !== null && aggFunc !== undefined;
      });
    // initial check
    const currentAgg = this.form.get('agg_func')?.value;
    this.showAggregation = currentAgg !== null && currentAgg !== undefined;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}