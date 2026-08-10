import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ColumnRefineAction, SandboxPreviewResponse } from '../models/refine.model';
import { DatasetOut } from '../models/dataset.model';

@Injectable({
  providedIn: 'root'
})
export class RefineService {
  private baseUrl = environment.apiUrl + '/datasets';

  constructor(private http: HttpClient) {}

  /**
   * Apply one action to the sandbox and get updated preview + full action list.
   */
  applyAction(datasetId: number, action: ColumnRefineAction): Observable<SandboxPreviewResponse> {
    return this.http.post<SandboxPreviewResponse>(
      `${this.baseUrl}/${datasetId}/refine/apply-action`,
      action
    );
  }

  /**
   * Undo the last action, return updated preview and action list.
   */
  undoAction(datasetId: number): Observable<SandboxPreviewResponse> {
    return this.http.delete<SandboxPreviewResponse>(
      `${this.baseUrl}/${datasetId}/refine/undo`
    );
  }


// ...

/**
 * Finalize the refinement pipeline.
 * Backend returns a full DatasetOut with updated status and refined_column_schema.
 */
finalize(datasetId: number): Observable<DatasetOut> {
  return this.http.post<DatasetOut>(
    `${this.baseUrl}/${datasetId}/refine/finalize`,
    {}
  );
}

}