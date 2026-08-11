import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataModelService } from 'src/app/core/services/data-model.service';
import { DataModelOut } from 'src/app/core/models/data-model.model';
import { HeaderTitleService } from 'src/app/core/services/header-title.service';

@Component({
  selector: 'app-model-detail',
  templateUrl: './model-detail.component.html',
  styleUrls: ['./model-detail.component.css']
})
export class ModelDetailComponent implements OnInit {
  model: DataModelOut | null = null;
  isLoading = true;
  error = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modelService: DataModelService,
    private headerTitleService: HeaderTitleService
  ) { this.headerTitleService.setTitle('Model Details'); }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/models']);
      return;
    }
    this.modelService.getModel(id).subscribe({
      next: (model) => {
        this.model = model;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load model', err);
        this.error = true;
        this.isLoading = false;
        // Optionally navigate back after a delay
        // this.router.navigate(['/models']);
      }
    });
  }
}