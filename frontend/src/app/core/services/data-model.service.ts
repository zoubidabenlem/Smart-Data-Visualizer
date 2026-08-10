import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  DataModelOut,
  PaginatedModelsOut,
  DataModelCreateRequest,
  DataModelUpdateRequest,
  AddDatasetsToModelRequest,
  TableRelationshipCreateRequest,
  TableRelationshipOut
} from '../models/data-model.model';
import { mapDatasetOut } from '../models/dataset.model';

@Injectable({ providedIn: 'root' })
export class DataModelService {
  private baseUrl = `${environment.apiUrl}/models`;

  constructor(private http: HttpClient) {}

  // List all models for current user
  getModels(page = 1, size = 20): Observable<PaginatedModelsOut> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PaginatedModelsOut>(this.baseUrl, { params });
  }

  // Get a single model with full datasets & relationships
  getModel(id: number): Observable<DataModelOut> {
    return this.http.get<DataModelOut>(`${this.baseUrl}/${id}`).pipe(
      // Ensure nested datasets have is_refined mapped
      map(model => ({
        ...model,
        datasets: model.datasets.map(md => ({
          ...md,
          dataset: mapDatasetOut(md.dataset)
        }))
      }))
    );
  }

  // Create a new model
  createModel(payload: DataModelCreateRequest): Observable<DataModelOut> {
    return this.http.post<DataModelOut>(this.baseUrl, payload);
  }

  // Update model (name, description, base_dataset)
  updateModel(id: number, payload: DataModelUpdateRequest): Observable<DataModelOut> {
    return this.http.put<DataModelOut>(`${this.baseUrl}/${id}`, payload);
  }

  // Delete a model
  deleteModel(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Datasets within a model
  addDatasetsToModel(modelId: number, payload: AddDatasetsToModelRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/${modelId}/datasets`, payload);
  }

  removeDatasetFromModel(modelId: number, datasetId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${modelId}/datasets/${datasetId}`);
  }

  // Relationships
  createRelationship(modelId: number, payload: TableRelationshipCreateRequest): Observable<TableRelationshipOut> {
    return this.http.post<TableRelationshipOut>(`${this.baseUrl}/${modelId}/relationships`, payload);
  }

  listRelationships(modelId: number): Observable<TableRelationshipOut[]> {
    return this.http.get<TableRelationshipOut[]>(`${this.baseUrl}/${modelId}/relationships`);
  }

  deleteRelationship(modelId: number, relId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${modelId}/relationships/${relId}`);
  }
}