# Smart-Data-Visualizer
Design and develop a web-based data visualization system that enables users to import datasets in Excel or CSV format, or connect to a MySQL database in read-only mode. It will allow the creation of interactive dashboards through a dedicated Builder mode for configuring visualizations and a Viewer mode for read-only access and consultation.
##  Project Overview

Smart Data Visualizer is a web-based data visualization system that allows users to:

- Import datasets in CSV or Excel format
- Connect to a MySQL database in read-only mode
- Prepare data through a basic processing pipeline
- Create interactive dashboards using a Builder mode
- View dashboards in read-only mode via a Viewer interface

The system is designed as a lightweight, secure alternative to complex Business Intelligence platforms.

---

## 🛠 Tech Stack

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