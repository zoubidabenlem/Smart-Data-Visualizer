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

```
Smart-Data-Visualizer
├─ backend
│  ├─ app
│  │  ├─ core
│  │  │  ├─ cache.py
│  │  │  ├─ config.py
│  │  │  ├─ exception_handlers.py
│  │  │  ├─ logging_config.py
│  │  │  ├─ logging_middleware.py
│  │  │  ├─ redis_client.py
│  │  │  ├─ security.py
│  │  │  └─ __init__.py
│  │  ├─ db
│  │  │  ├─ base.py
│  │  │  ├─ init_db.py
│  │  │  └─ __init__.py
│  │  ├─ dependencies
│  │  │  ├─ auth_dependencies.py
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
│  │  │  ├─ dashboard_router.py
│  │  │  ├─ dataset_router.py
│  │  │  ├─ task_router.py
│  │  │  ├─ user_router.py
│  │  │  └─ __init__.py
│  │  ├─ schemas
│  │  │  ├─ auth_schemas.py
│  │  │  ├─ config_schema.json
│  │  │  ├─ dashboard_schemas.py
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
│  │  │  ├─ sandbox_service.py
│  │  │  ├─ task_manager.py
│  │  │  └─ __init__.py
│  │  └─ __init__.py
│  ├─ corrupt.csv
│  ├─ Dockerfile
│  ├─ generate_schema.py
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
│  ├─ sample.csv
│  ├─ sample.xlsx
│  ├─ tests
│  │  ├─ RefineSandbox2_Tests.postman_collection.json
│  │  ├─ RefineSandbox_Tests.postman_collection.json
│  │  ├─ test_dataset.csv
│  │  ├─ test_dataset_gen.py
│  │  └─ test_refine_pipeline.py
│  ├─ test_pipe.py
│  └─ __init__.py
├─ docker-compose.yml
├─ docs
├─ frontend
│  ├─ .editorconfig
│  ├─ angular.json
│  ├─ config_schema.json
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
│  │  │  │  │  ├─ dashboard.model.ts
│  │  │  │  │  ├─ dataset.model.ts
│  │  │  │  │  └─ user.model.ts
│  │  │  │  ├─ services
│  │  │  │  │  ├─ builder-state.service.ts
│  │  │  │  │  ├─ dashboard.service.spec.ts
│  │  │  │  │  ├─ dashboard.service.ts
│  │  │  │  │  ├─ dataset.service.spec.ts
│  │  │  │  │  ├─ dataset.service.ts
│  │  │  │  │  ├─ services.module.ts
│  │  │  │  │  └─ user.service.ts
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
│  │  │  │  │  ├─ builder-routing.module.ts
│  │  │  │  │  ├─ builder.component.css
│  │  │  │  │  ├─ builder.component.html
│  │  │  │  │  ├─ builder.component.ts
│  │  │  │  │  ├─ builder.module.ts
│  │  │  │  │  ├─ column-picker
│  │  │  │  │  │  ├─ column-picker.component.css
│  │  │  │  │  │  ├─ column-picker.component.html
│  │  │  │  │  │  ├─ column-picker.component.spec.ts
│  │  │  │  │  │  └─ column-picker.component.ts
│  │  │  │  │  ├─ configure-header
│  │  │  │  │  │  ├─ configure-header.component.css
│  │  │  │  │  │  ├─ configure-header.component.html
│  │  │  │  │  │  └─ configure-header.component.ts
│  │  │  │  │  ├─ dataset-list
│  │  │  │  │  │  ├─ dataset-list.component.css
│  │  │  │  │  │  ├─ dataset-list.component.html
│  │  │  │  │  │  ├─ dataset-list.component.spec.ts
│  │  │  │  │  │  └─ dataset-list.component.ts
│  │  │  │  │  ├─ dataset-upload
│  │  │  │  │  │  ├─ dataset-upload.component.css
│  │  │  │  │  │  ├─ dataset-upload.component.html
│  │  │  │  │  │  ├─ dataset-upload.component.spec.ts
│  │  │  │  │  │  └─ dataset-upload.component.ts
│  │  │  │  │  ├─ preview-modal
│  │  │  │  │  │  ├─ preview-modal.component.css
│  │  │  │  │  │  ├─ preview-modal.component.html
│  │  │  │  │  │  ├─ preview-modal.component.spec.ts
│  │  │  │  │  │  └─ preview-modal.component.ts
│  │  │  │  │  └─ refine-schema
│  │  │  │  ├─ dashboards
│  │  │  │  │  ├─ components
│  │  │  │  │  │  ├─ create-dashboard-dialog
│  │  │  │  │  │  │  ├─ create-dashboard-dialog.component.css
│  │  │  │  │  │  │  ├─ create-dashboard-dialog.component.html
│  │  │  │  │  │  │  ├─ create-dashboard-dialog.component.spec.ts
│  │  │  │  │  │  │  └─ create-dashboard-dialog.component.ts
│  │  │  │  │  │  ├─ widget-config-dialog
│  │  │  │  │  │  │  ├─ widget-config-dialog.component.css
│  │  │  │  │  │  │  ├─ widget-config-dialog.component.html
│  │  │  │  │  │  │  ├─ widget-config-dialog.component.spec.ts
│  │  │  │  │  │  │  └─ widget-config-dialog.component.ts
│  │  │  │  │  │  └─ widget-popup
│  │  │  │  │  │     ├─ widget-popup.component.css
│  │  │  │  │  │     ├─ widget-popup.component.html
│  │  │  │  │  │     ├─ widget-popup.component.spec.ts
│  │  │  │  │  │     └─ widget-popup.component.ts
│  │  │  │  │  ├─ dashboards-routing.module.ts
│  │  │  │  │  ├─ dashboards.module.ts
│  │  │  │  │  ├─ pages
│  │  │  │  │  │  ├─ dashboard-editor
│  │  │  │  │  │  │  ├─ dashboard-editor.component.css
│  │  │  │  │  │  │  ├─ dashboard-editor.component.html
│  │  │  │  │  │  │  ├─ dashboard-editor.component.spec.ts
│  │  │  │  │  │  │  └─ dashboard-editor.component.ts
│  │  │  │  │  │  ├─ dashboard-list
│  │  │  │  │  │  │  ├─ dashboard-list.component.css
│  │  │  │  │  │  │  ├─ dashboard-list.component.html
│  │  │  │  │  │  │  ├─ dashboard-list.component.spec.ts
│  │  │  │  │  │  │  └─ dashboard-list.component.ts
│  │  │  │  │  │  └─ dashboard-viewer
│  │  │  │  │  │     ├─ dashboard-viewer.component.css
│  │  │  │  │  │     ├─ dashboard-viewer.component.html
│  │  │  │  │  │     └─ dashboard-viewer.component.ts
│  │  │  │  │  └─ services
│  │  │  │  │     ├─ dashboard-editor.service.ts
│  │  │  │  │     └─ gridster.service.ts
│  │  │  │  ├─ landing
│  │  │  │  │  ├─ landing-page.component.css
│  │  │  │  │  ├─ landing-page.component.html
│  │  │  │  │  ├─ landing-page.component.spec.ts
│  │  │  │  │  ├─ landing-page.component.ts
│  │  │  │  │  ├─ landing-routing.module.ts
│  │  │  │  │  └─ landing.module.ts
│  │  │  │  ├─ user-management
│  │  │  │  │  ├─ assign-dashboards-dialog
│  │  │  │  │  │  ├─ assign-dashboards-dialog.component.css
│  │  │  │  │  │  ├─ assign-dashboards-dialog.component.html
│  │  │  │  │  │  └─ assign-dashboards-dialog.component.ts
│  │  │  │  │  ├─ user-management.component.css
│  │  │  │  │  ├─ user-management.component.html
│  │  │  │  │  ├─ user-management.component.ts
│  │  │  │  │  └─ user-management.module.ts
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
│  │  │  │     ├─ profile
│  │  │  │     │  ├─ profile.component.css
│  │  │  │     │  ├─ profile.component.html
│  │  │  │     │  └─ profile.component.ts
│  │  │  │     ├─ viewer-routing.module.ts
│  │  │  │     └─ viewer.module.ts
│  │  │  └─ shared
│  │  │     ├─ components
│  │  │     │  ├─ components.module.ts
│  │  │     │  ├─ footer
│  │  │     │  │  ├─ footer.component.css
│  │  │     │  │  ├─ footer.component.html
│  │  │     │  │  ├─ footer.component.spec.ts
│  │  │     │  │  └─ footer.component.ts
│  │  │     │  ├─ header
│  │  │     │  │  ├─ header.component.css
│  │  │     │  │  ├─ header.component.html
│  │  │     │  │  ├─ header.component.spec.ts
│  │  │     │  │  └─ header.component.ts
│  │  │     │  └─ widget-chart
│  │  │     │     ├─ widget-chart.component.css
│  │  │     │     ├─ widget-chart.component.html
│  │  │     │     ├─ widget-chart.component.spec.ts
│  │  │     │     └─ widget-chart.component.ts
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