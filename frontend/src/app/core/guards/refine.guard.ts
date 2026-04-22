// refine.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { DatasetService } from '../services/dataset.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RefineGuard implements CanActivate {
  constructor(private datasetService: DatasetService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot) {
    const datasetId = +route.paramMap.get('datasetId')!;
    return this.datasetService.getDataset(datasetId).pipe(
      map(dataset => {
        if (dataset.is_refined) {
          this.router.navigate(['/builder/columns', datasetId]);
          return false;
        }
        return true;
      }),
      catchError(() => {
        this.router.navigate(['/builder']);
        return of(false);
      })
    );
  }
}