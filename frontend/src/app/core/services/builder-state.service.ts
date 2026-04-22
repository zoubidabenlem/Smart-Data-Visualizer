import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BuilderStateService {
  private refinedColumnsSubject = new BehaviorSubject<any[] | null>(null);
  refinedColumns$ = this.refinedColumnsSubject.asObservable();

  setRefinedColumns(columns: any[]) {
    this.refinedColumnsSubject.next(columns);
  }

  clear() {
    this.refinedColumnsSubject.next(null);
  }
}