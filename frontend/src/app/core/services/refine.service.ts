import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ColumnRefineAction, SandboxPreviewResponse } from '../models/refine.model';

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

  /**
   * Finalize the refinement pipeline. Returns the dataset info (like old RefineSchemaResponse).
   * We'll define a simple response interface or reuse DatasetOut.
   */
  finalize(datasetId: number): Observable<{ dataset_id: number; refined_columns: any[]; is_refined: boolean }> {
    return this.http.post<{ dataset_id: number; refined_columns: any[]; is_refined: boolean }>(
      `${this.baseUrl}/${datasetId}/refine/finalize`,
      {}
    );
  }
}