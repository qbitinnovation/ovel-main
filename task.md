- `[x]` Create `ReportSnapshot` model
- `[x]` Create `Anomaly` model
- `[x]` Create `/api/reports/engine/route.ts` for lazy aggregation
- `[x]` Add trigger logic for Maintenance Delay
- `[x]` Add trigger logic for Late Payment
- `[x]` Add trigger logic for Sales Drop

## Phase 2: Module-Specific Reports
- `[x]` Create Accounts Report (`/superadmin/reports/accounts/page.tsx`)
- `[x]` Create Sales Report (`/superadmin/reports/sales/page.tsx`)
- `[x]` Create Maintenance Report (`/superadmin/reports/maintenance/page.tsx`)
- `[x]` Create Inventory Report (`/superadmin/reports/inventory/page.tsx`)

## Phase 3: The Master Report
- `[x]` Update `/superadmin/reports/page.tsx` as Consolidated Dashboard
- `[x]` Implement Global Date Filter

## Phase 4: Complaints & Feedback Module
- `[x]` Create `Complaint` model
- `[x]` Add module definitions to `lib/constants.ts`
- `[x]` Create `/api/complaints/route.ts`
- `[x]` Create Complaints UI for SuperAdmin
- `[x]` Create Complaints UI for Committee/Turf Manager
- `[x]` Update navigation layout for SuperAdmin, Committee, and Turf Manager

## Phase 5: PDF Export Pipeline
- `[x]` Create `lib/pdfGenerator.ts` using `jspdf`
- `[x]` Add "Download PDF" buttons to reports
- `[x]` Format PDF layout with branding and tables
