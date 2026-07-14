import { Component, Inject, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DashboardListItem } from 'src/app/core/models/dashboard.model';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { UserService } from 'src/app/core/services/user.service';

@Component({
  selector: 'app-assign-dashboards-dialog',
  templateUrl: './assign-dashboards-dialog.component.html',
  styleUrls: ['./assign-dashboards-dialog.component.css']
})
export class AssignDashboardsDialogComponent implements OnInit {
  allDashboards: DashboardListItem[] = [];
  filteredDashboards: DashboardListItem[] = [];
  selectedDashboards: number[] = [];
  searchControl = new FormControl('');
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<AssignDashboardsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user: any },
    private userService: UserService,
    private dashboardService: DashboardService
  ) {}

  ngOnInit() {
  /// 1. Get all dashboards (admin sees all)
    this.dashboardService.listDashboards('', 1, 1000).subscribe({
      next: (res) => {
        this.allDashboards = res.items;      // ✅ always a plain array
        this.filteredDashboards = [...this.allDashboards];

        // 2. Get currently assigned dashboards for this user
        this.userService.getUserAssignedDashboards(this.data.user.id).subscribe(assigned => {
          this.selectedDashboards = assigned.map(d => d.id);
        });
      },
      error: (err) => console.error('Failed to load dashboards', err)
    });

    // Search filter (works because allDashboards is an array)
    this.searchControl.valueChanges.subscribe(term => {
      const lower = term?.toLowerCase() || '';
      this.filteredDashboards = this.allDashboards.filter(d =>
        d.title.toLowerCase().includes(lower)
      );
    });
  }

  async save() {
    this.saving = true;
     this.dialogRef.close();


  try {
    // Use firstValueFrom – it throws if the observable errors or completes without a value.
    const currentAssigned = await firstValueFrom(
      this.userService.getUserAssignedDashboards(this.data.user.id)
    );    
    const currentIds = currentAssigned.map(d => d.id);
    const toAdd = this.selectedDashboards.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !this.selectedDashboards.includes(id));

    const requests = [
      ...toAdd.map(id =>
        firstValueFrom(
          this.userService.assignDashboardToUser(id, this.data.user.id)
        )
      ),
      ...toRemove.map(id =>
        firstValueFrom(
          this.userService.unassignDashboardFromUser(id, this.data.user.id)
        )
      )
    ];
    await Promise.all(requests);
    this.dialogRef.close(true);
  } catch (err) {
    // handle error (e.g., show a toast)
    console.error('Assignment update failed', err);
  } finally {
    this.saving = false;
  }
  }

  cancel() {
    this.dialogRef.close();
  }
}