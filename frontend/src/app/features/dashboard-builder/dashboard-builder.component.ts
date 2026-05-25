import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DashboardBuilderStateService } from '../../core/services/dashboard-builder-state.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { DatasetService } from '../../core/services/dataset.service';
import { HttpErrorResponse } from '@angular/common/http';
@Component({
  selector: 'app-dashboard-builder',
  templateUrl: './dashboard-builder.component.html',
  styleUrls: ['./dashboard-builder.component.css']
})
export class DashboardBuilderComponent implements OnInit, OnDestroy {
  @ViewChild('stepper') stepper!: MatStepper;
  private destroy$ = new Subject<void>();
  datasetId!: number;
  
  // Step validity flags
  step2Valid = false; // chart type & axes
  step3Valid = true;  // filters (optional)
  step4Valid = true;  // aggregation (optional)
  step5Valid = false; // title & advanced

  chartNeedsAxes = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public state: DashboardBuilderStateService,
    private datasetService: DatasetService,
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    // 1. Get dataset ID from route
    this.datasetId = +this.route.snapshot.paramMap.get('datasetId')!;
    if (isNaN(this.datasetId)) {
      this.router.navigate(['/builder']);
      return;
    }

    // 2. Set dataset_id in form
    this.state.form.patchValue({ dataset_id: this.datasetId });

    // 3. Fetch dataset schema to get columns
    this.datasetService.getDatasetColumns(this.datasetId).subscribe({
    next: (columns: any[]) => {
      this.state.setColumns(columns); // pass the array directly
    },
    error: (err: HttpErrorResponse) => {
      console.error('Failed to load dataset columns', err);
      this.router.navigate(['/builder']);
    }
  });

  //REMOVE THIS LATER - for testing only
  this.datasetService.getDatasetColumns(this.datasetId).subscribe({
  next: (response: any) => {
    console.log('Raw columns response:', response);
    // Adjust this extraction based on what you see in the console:
    const columns = response.columns ?? response.data?.columns ?? response.results ?? [];
    this.state.setColumns(columns);
  },
  error: (err: HttpErrorResponse) => {
    console.error('Failed to load dataset columns', err);
    this.router.navigate(['/builder']);
  }
});

    // 4. Subscribe to step validities from the state service
    this.state.step2Valid$.pipe(takeUntil(this.destroy$)).subscribe(v => this.step2Valid = v);
    this.state.step3Valid$.pipe(takeUntil(this.destroy$)).subscribe(v => this.step3Valid = v);
    this.state.step4Valid$.pipe(takeUntil(this.destroy$)).subscribe(v => this.step4Valid = v);
    this.state.step5Valid$.pipe(takeUntil(this.destroy$)).subscribe(v => this.step5Valid = v);

    // 5. Track chart type to show/hide axes UI
    this.state.chartType$.pipe(takeUntil(this.destroy$)).subscribe(type => {
      this.chartNeedsAxes = this.state.chartNeedsAxes(type);
    });
  }

  submitDashboard(): void {
    if (this.state.form.invalid) {
      this.state.form.markAllAsTouched();
      return;
    }

    const config = this.state.buildConfig();
    this.dashboardService.create(config).subscribe({
      next: (res) => {
        // Navigate to the viewer or dashboard list after creation
        this.router.navigate(['/viewer', res.id]);
      },
      error: (err) => {
        if (err.status === 422 && err.error?.detail) {
          this.state.mapBackendErrors(err.error.detail);
          // Optionally scroll to first error
        } else {
          console.error('Dashboard creation failed', err);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}