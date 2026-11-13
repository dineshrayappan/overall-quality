# Digital Garment Quality Management & Automated Reporting System (QMS)

Full-stack React + Node.js + Express + MongoDB Digital Garment QMS digitizing four manual factory inspection reports with shared master data, role-based access control, approval workflows, automated dashboards, and PDF/Excel report generation.

## Architecture Overview

- **Frontend (`client/`)**: React 18, Vite 6, React Router, Axios, Recharts, Lucide React
- **Backend (`server/`)**: Node.js (ESM), Express, Mongoose (MongoDB), JWT Authentication, RBAC Middleware, Multer (image persistence), PDFKit, ExcelJS
- **Database (`MongoDB`)**: `garment_qms` (system bootstrap creates only role permissions, default inspection configs, and default company settings — zero dummy users or production records)

## Key Project Files

### Backend (`server/src/`)
- `app.js` / `server.js`: Express app setup, security middleware (`helmet`, `cors`, `morgan`), route mounting
- `config/`: `env.js`, `db.js`, `upload.js` (JPEG/PNG/WebP disk upload persistence)
- `models/`:
  - Core & governance: `User.js`, `RolePermission.js`, `CompanySetting.js`, `InspectionConfig.js`, `ApprovalHistory.js`, `InspectionAttachment.js`, `AuditLog.js`, `Counter.js`
  - Common Masters (`models/masters/`): 16 master collections (`Buyer`, `Supplier`, `Style`, `Order`, `Fabric`, `Colour`, `Gsm`, `SizeRange`, `ProductionLine`, `Department`, `Employee`, `Process`, `Machine`, `Needle`, `MeasurementSpec`, `InspectionCheckpoint`)
  - Inspections (`models/inspections/`): `TargetChart.js`, `SizeSetInspection.js`, `SevenPointInspection.js`, `MeasurementInspection.js`
- `services/`: `bootstrapService.js`, `calculationService.js`, `approvalService.js`, `dashboardService.js`, `pdfService.js`, `excelService.js`, `auditService.js`
- `routes/`: `authRoutes.js`, `userRoutes.js`, `masterRoutes.js`, `configRoutes.js`, `targetChartRoutes.js`, `sizeSetRoutes.js`, `sevenPointRoutes.js`, `measurementRoutes.js`, `attachmentRoutes.js`, `dashboardRoutes.js`, `exportRoutes.js`, `auditRoutes.js`

### Frontend (`client/src/`)
- `App.jsx`: Protected routing, setup gate, RBAC page wrappers
- `context/AuthContext.jsx`: Session state, setup status, permission helper
- `components/common/`: `Layout.jsx`, `ModalDialog.jsx`, `SearchableSelect.jsx`, `OrderAutoFillHeader.jsx`, `PhotoUploader.jsx`, `AuthImage.jsx`, `ApprovalPanel.jsx`, `PdfPreviewModal.jsx`, `StatusBadge.jsx`
- `pages/`: `AuthPages.jsx`, `DashboardPage.jsx`, `TargetChartPage.jsx`, `SizeSetPage.jsx`, `SevenPointPage.jsx`, `MeasurementPage.jsx`, `MasterDataPage.jsx`, `ExcelExportPage.jsx`, `UsersPage.jsx`, `ConfigurationPage.jsx`, `AuditLogsPage.jsx`

## Prerequisites

- Node.js (v18+ / tested on v24.21.0)
- MongoDB running locally on `mongodb://127.0.0.1:27017` (or configured via `MONGO_URI` in `server/.env`)

## Running the Project

### 1. Start the Backend API (`http://localhost:5000`)
```bash
cd server
npm install
npm start
```
For watch mode during development: `npm run dev`.

### 2. Start the Frontend (`http://localhost:5173`)
```bash
cd client
npm install
npm run dev
```
Vite proxies `/api/*` requests to `http://127.0.0.1:5000`.

### 3. First-Time Administrator Setup (or Optional Demo Seed)
On a clean database with zero users, opening `http://localhost:5173` displays the one-time **Initial Setup** screen (`/setup`) where you create the first Administrator account and set your company name. After the first user is created, `/setup` locks permanently.

To populate realistic sample users, all 16 master collections, multi-day inspections across all 4 modules, sample defect images, approval histories, and audit logs for evaluation:
```bash
cd server
npm run seed:demo     # idempotent demo seed
npm run seed:reset    # wipe & re-seed demo dataset cleanly
```
Demo login accounts created (`Demo@1234`): `admin` (Admin), `qam` (Quality Manager), `supervisor1` (Supervisor), `qc1` (QC Inspector).

## Automated Verification

### Backend Integration & Calculation Tests
Runs in an isolated test database (`garment_qms_test`) and isolated upload directory (`uploads_test`), cleaning both afterward:
```bash
cd server
npm test
```

### Frontend Production Build
```bash
cd client
npm run build
```

## REST API Endpoints Summary
- `GET /api/health` — Service health status
- `/api/auth` — `setup-status`, `setup`, `login`, `me`, `change-password`
- `/api/users` — User account creation & role/line updates
- `/api/masters/:entity` — Search, create, update, soft-archive across all 16 master entities, plus `GET /api/masters/orders/:id/populated` and `GET /api/masters/measurement-specs/for-style`
- `/api/config` — Company settings (name/logo), RBAC role matrix, and configurable inspection templates/rules
- `/api/inspections/{target-charts,size-sets,seven-points,measurements}` — CRUD, `submit`, `approve`, `reject` (`returnForCorrection`), `revise` (controlled versioning), `archive`, plus `GET /api/inspections/target-charts/analytics`
- `/api/attachments` — Authenticated multipart image/logo uploads & file streaming
- `/api/dashboard/analytics` — Live aggregated KPI cards & chart datasets
- `/api/exports` — PDF & Excel exports (`pdf/:module/:id`, `excel/individual/:module/:id`, filtered/monthly `excel`)
- `/api/audit-logs` — Searchable audit trail across system actions

