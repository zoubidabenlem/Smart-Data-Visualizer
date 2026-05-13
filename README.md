# Smart-Data-Visualizer
Design and develop a web-based data visualization sDesign and develop a web-based data visualization system that enables users to import datasets in Excel or CSV format, or connect to a MySQL database in read-only mode.

A simple authentication mechanism will be implemented to ensure secure access to system resources.

The system will include a basic data preparation pipeline (cleaning, filtering, and aggregations) and will allow the creation of interactive dashboards through a dedicated Builder mode for configuring visualizations and a Viewer mode for read-only access and consultation.
##  Project Overview

Smart Data Visualizer is a web-based data visualization system that allows users to:

- Import datasets in CSV or Excel format
- Connect to a MySQL database in read-only mode
- Prepare data through a basic processing pipeline
- Create interactive dashboards using a Builder mode
- View dashboards in read-only mode via a Viewer interface

The system is designed as a lightweight, secure alternative to complex Business Intelligence platforms.

---

##  Tech Stack

### Backend
- Python
- FastAPI
- Pandas (data processing)
- SQLAlchemy
- MySQL (metadata storage)

### Frontend
- Angular
- Chart.js / ngx-charts (data visualization)

---

##  Core Features

- Simple authentication (users & roles)
- CSV / Excel file import
- MySQL read-only connection
- Data cleaning, filtering, and aggregation
- Dashboard Builder mode
- Dashboard Viewer mode
- Basic caching mechanism

---

##  Getting Started

### 1- Clone the repository

```bash
git clone <your-repository-url>
cd smart-data-visualizer
```
### 3- Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # (Linux/Mac)
venv\Scripts\activate     # (Windows)

pip install -r requirements.txt
uvicorn main:app --reload
```
Backend runs on:
```bash
http://localhost:8000
```
### 3- Frontend Setup
```bash
cd frontend
npm install
ng serve
```
Frontend runs on:
```bash
http://localhost:4200
```
## Project Structure (Initial)
```
smart-data-visualizer/
│
├── backend/
│   ├── app/
│   ├── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   └── angular.json
│
└── README.md
```
### Project Status
This project is currently under active development as part of an academic MVP.
```
Smart-Data-Visualizer
├─ backend
│  ├─ app
│  │  ├─ api
│  │  │  └─ __init__.py
│  │  ├─ core
│  │  │  ├─ cache.py
│  │  │  ├─ config.py
│  │  │  ├─ logging_config.py
│  │  │  ├─ security.py
│  │  │  └─ __init__.py
│  │  ├─ db
│  │  │  ├─ base.py
│  │  │  ├─ init_db.py
│  │  │  └─ __init__.py
│  │  ├─ dependencies
│  │  │  ├─ auth_dependencies.py
│  │  │  └─ __init__.py
│  │  ├─ endpoints
│  │  │  └─ __init__.py
│  │  ├─ models
│  │  │  ├─ base.py
│  │  │  ├─ cache_entry.py
│  │  │  ├─ dashboard.py
│  │  │  ├─ dataset.py
│  │  │  ├─ role.py
│  │  │  ├─ user.py
│  │  │  └─ __init__.py
│  │  ├─ routers
│  │  │  ├─ auth_router.py
│  │  │  ├─ dataset_router.py
│  │  │  ├─ task_router.py
│  │  │  └─ __init__.py
│  │  ├─ schemas
│  │  │  ├─ auth_schemas.py
│  │  │  ├─ dataset_schemas.py
│  │  │  ├─ pipeline.py
│  │  │  ├─ refine_schema.py
│  │  │  └─ __init__.py
│  │  ├─ scripts
│  │  │  └─ test_pipeline.py
│  │  ├─ services
│  │  │  ├─ fileUpload_service.py
│  │  │  ├─ pipeline
│  │  │  │  ├─ aggregations.py
│  │  │  │  ├─ filters.py
│  │  │  │  ├─ missing.py
│  │  │  │  ├─ orchestrator.py
│  │  │  │  ├─ utils.py
│  │  │  │  ├─ validation.py
│  │  │  │  └─ __init__.py
│  │  │  ├─ refine_service.py
│  │  │  ├─ task_manager.py
│  │  │  └─ __init__.py
│  │  └─ __init__.py
│  ├─ Dockerfile
│  ├─ logs
│  ├─ main.py
│  ├─ pipeline_test_output
│  │  ├─ comparison_report.txt
│  │  ├─ prepare_result.json
│  │  ├─ preview_after_36.json
│  │  ├─ preview_before_33.json
│  │  ├─ preview_before_34.json
│  │  ├─ preview_before_35.json
│  │  └─ preview_before_36.json
│  ├─ README.md
│  ├─ refine.json
│  ├─ requirements.txt
│  ├─ tests
│  │  ├─ test_dataset.csv
│  │  └─ test_dataset_gen.py
│  ├─ test_pipe.py
│  └─ __init__.py
├─ docker-compose.yml
├─ docs
│  └─ .project_structure_ignore
├─ frontend
│  ├─ .editorconfig
│  ├─ angular.json
│  ├─ Dockerfile
│  ├─ nginx.conf
│  ├─ package.json
│  ├─ README.md
│  ├─ src
│  │  ├─ app
│  │  │  ├─ app-routing.module.ts
│  │  │  ├─ app.component.css
│  │  │  ├─ app.component.html
│  │  │  ├─ app.component.spec.ts
│  │  │  ├─ app.component.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ core
│  │  │  │  ├─ auth
│  │  │  │  │  ├─ auth.guard.spec.ts
│  │  │  │  │  ├─ auth.guard.ts
│  │  │  │  │  ├─ auth.module.ts
│  │  │  │  │  ├─ auth.service.spec.ts
│  │  │  │  │  ├─ auth.service.ts
│  │  │  │  │  ├─ role.guard.spec.ts
│  │  │  │  │  └─ role.guard.ts
│  │  │  │  ├─ core.module.ts
│  │  │  │  ├─ guards
│  │  │  │  │  └─ refine.guard.ts
│  │  │  │  ├─ interceptors
│  │  │  │  │  ├─ interceptors.module.ts
│  │  │  │  │  ├─ jwt.interceptor.spec.ts
│  │  │  │  │  └─ jwt.interceptor.ts
│  │  │  │  ├─ models
│  │  │  │  │  ├─ dataset.model.ts
│  │  │  │  │  └─ user.model.ts
│  │  │  │  ├─ services
│  │  │  │  │  ├─ builder-state.service.ts
│  │  │  │  │  ├─ chart-builder-state.service.ts
│  │  │  │  │  ├─ dashboard.service.spec.ts
│  │  │  │  │  ├─ dashboard.service.ts
│  │  │  │  │  ├─ dataset.service.spec.ts
│  │  │  │  │  ├─ dataset.service.ts
│  │  │  │  │  └─ services.module.ts
│  │  │  │  └─ unauthorized
│  │  │  │     ├─ unauthorized.component.css
│  │  │  │     ├─ unauthorized.component.html
│  │  │  │     ├─ unauthorized.component.spec.ts
│  │  │  │     └─ unauthorized.component.ts
│  │  │  ├─ features
│  │  │  │  ├─ auth
│  │  │  │  │  ├─ auth-routing.module.ts
│  │  │  │  │  ├─ auth.module.ts
│  │  │  │  │  ├─ login
│  │  │  │  │  │  ├─ login.component.css
│  │  │  │  │  │  ├─ login.component.html
│  │  │  │  │  │  ├─ login.component.spec.ts
│  │  │  │  │  │  └─ login.component.ts
│  │  │  │  │  └─ register
│  │  │  │  │     ├─ register.component.css
│  │  │  │  │     ├─ register.component.html
│  │  │  │  │     ├─ register.component.spec.ts
│  │  │  │  │     └─ register.component.ts
│  │  │  │  ├─ builder
│  │  │  │  │  ├─ aggregation
│  │  │  │  │  │  ├─ aggregation.component.css
│  │  │  │  │  │  ├─ aggregation.component.html
│  │  │  │  │  │  ├─ aggregation.component.spec.ts
│  │  │  │  │  │  └─ aggregation.component.ts
│  │  │  │  │  ├─ builder-routing.module.ts
│  │  │  │  │  ├─ builder.component.css
│  │  │  │  │  ├─ builder.component.html
│  │  │  │  │  ├─ builder.component.ts
│  │  │  │  │  ├─ builder.module.ts
│  │  │  │  │  ├─ chart-type-selector
│  │  │  │  │  │  ├─ chart-type-selector.component.css
│  │  │  │  │  │  ├─ chart-type-selector.component.html
│  │  │  │  │  │  ├─ chart-type-selector.component.spec.ts
│  │  │  │  │  │  └─ chart-type-selector.component.ts
│  │  │  │  │  ├─ column-picker
│  │  │  │  │  │  ├─ column-picker.component.css
│  │  │  │  │  │  ├─ column-picker.component.html
│  │  │  │  │  │  ├─ column-picker.component.spec.ts
│  │  │  │  │  │  └─ column-picker.component.ts
│  │  │  │  │  ├─ dashboard-save
│  │  │  │  │  │  ├─ dashboard-save.component.css
│  │  │  │  │  │  ├─ dashboard-save.component.html
│  │  │  │  │  │  ├─ dashboard-save.component.spec.ts
│  │  │  │  │  │  └─ dashboard-save.component.ts
│  │  │  │  │  ├─ dataset-list
│  │  │  │  │  │  ├─ dataset-list.component.css
│  │  │  │  │  │  ├─ dataset-list.component.html
│  │  │  │  │  │  ├─ dataset-list.component.spec.ts
│  │  │  │  │  │  └─ dataset-list.component.ts
│  │  │  │  │  ├─ dataset-selector
│  │  │  │  │  │  ├─ dataset-selector.component.css
│  │  │  │  │  │  ├─ dataset-selector.component.html
│  │  │  │  │  │  ├─ dataset-selector.component.spec.ts
│  │  │  │  │  │  └─ dataset-selector.component.ts
│  │  │  │  │  ├─ dataset-upload
│  │  │  │  │  │  ├─ dataset-upload.component.css
│  │  │  │  │  │  ├─ dataset-upload.component.html
│  │  │  │  │  │  ├─ dataset-upload.component.spec.ts
│  │  │  │  │  │  └─ dataset-upload.component.ts
│  │  │  │  │  ├─ filter-builder
│  │  │  │  │  │  ├─ filter-builder.component.css
│  │  │  │  │  │  ├─ filter-builder.component.html
│  │  │  │  │  │  ├─ filter-builder.component.spec.ts
│  │  │  │  │  │  └─ filter-builder.component.ts
│  │  │  │  │  ├─ preview-modal
│  │  │  │  │  │  ├─ preview-modal.component.css
│  │  │  │  │  │  ├─ preview-modal.component.html
│  │  │  │  │  │  ├─ preview-modal.component.spec.ts
│  │  │  │  │  │  └─ preview-modal.component.ts
│  │  │  │  │  └─ refine-schema
│  │  │  │  │     ├─ refine-schema.component.css
│  │  │  │  │     ├─ refine-schema.component.html
│  │  │  │  │     └─ refine-schema.component.ts
│  │  │  │  ├─ landing
│  │  │  │  │  ├─ landing-page.component.css
│  │  │  │  │  ├─ landing-page.component.html
│  │  │  │  │  ├─ landing-page.component.spec.ts
│  │  │  │  │  ├─ landing-page.component.ts
│  │  │  │  │  ├─ landing-routing.module.ts
│  │  │  │  │  └─ landing.module.ts
│  │  │  │  └─ viewer
│  │  │  │     ├─ dashboard-list
│  │  │  │     │  ├─ dashboard-list.component.css
│  │  │  │     │  ├─ dashboard-list.component.html
│  │  │  │     │  ├─ dashboard-list.component.spec.ts
│  │  │  │     │  └─ dashboard-list.component.ts
│  │  │  │     ├─ dashboard-view
│  │  │  │     │  ├─ dashboard-view.component.css
│  │  │  │     │  ├─ dashboard-view.component.html
│  │  │  │     │  ├─ dashboard-view.component.spec.ts
│  │  │  │     │  └─ dashboard-view.component.ts
│  │  │  │     ├─ viewer-routing.module.ts
│  │  │  │     └─ viewer.module.ts
│  │  │  └─ shared
│  │  │     ├─ components
│  │  │     │  ├─ chart
│  │  │     │  │  ├─ chart.component.css
│  │  │     │  │  ├─ chart.component.html
│  │  │     │  │  ├─ chart.component.spec.ts
│  │  │     │  │  └─ chart.component.ts
│  │  │     │  ├─ components.module.ts
│  │  │     │  ├─ footer
│  │  │     │  │  ├─ footer.component.css
│  │  │     │  │  ├─ footer.component.html
│  │  │     │  │  ├─ footer.component.spec.ts
│  │  │     │  │  └─ footer.component.ts
│  │  │     │  └─ header
│  │  │     │     ├─ header.component.css
│  │  │     │     ├─ header.component.html
│  │  │     │     ├─ header.component.spec.ts
│  │  │     │     └─ header.component.ts
│  │  │     ├─ models
│  │  │     │  └─ models.module.ts
│  │  │     └─ shared.module.ts
│  │  ├─ assets
│  │  │  └─ images
│  │  │     ├─ landing_bg.jpg
│  │  │     └─ logo.png
│  │  ├─ environments
│  │  ├─ favicon.ico
│  │  ├─ index.html
│  │  ├─ main.ts
│  │  └─ styles.css
│  ├─ tsconfig.app.json
│  ├─ tsconfig.json
│  └─ tsconfig.spec.json
└─ README.md

```