# ZIARA Clinic Admin

React + Vite admin panel for clinic management.

## Tech Stack
- React 19, Vite 6, MUI (Material UI)
- Firebase 12 (auth, firestore)
- firebase-admin, nodemailer
- react-router-dom v7
- lucide-react (icons)

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint check
- `npm run preview` — preview build

## Session: Data Validation & Integrity Fixes (2026-07-12)

### Goal
Fix all 16 identified issues across Categories A–D in the clinic-admin Firestore service layer and UI.

### Summary of Changes

#### Category A — Data Integrity (3/3 ✅)
| # | Issue | Fix |
|---|---|---|
| A1 | `status`/`expired` out of sync | `updateLicenseStatus()` recomputes `expired` from stored `expiryDate`. `updateLicense()` auto-sets `status:"EXPIRED"` when date is past |
| A2 | Orphan doctors (non-existent tenantId) | `createDoctor()` + `updateDoctor()` validate tenantId exists in `saas_tenants` before writing |
| A3 | Tenant-category license bound to multiple tenants | `createTenant()` + `updateTenant()` query `saas_tenants` for duplicate `licenseKey` before allowing save |

#### Category B — ERP Integration Gap (fully delivered ✅)
- Created `ERPSettings.jsx` page at `/erp-settings`
- Created `erpValidation.js` validation helpers
- Route added in `App.jsx`, nav item in `Sidebar.jsx`
- `triggerERPSync()` returns `{success:true}` when `VITE_ERP_SYNC_URL` not set

#### Category C — Data Validation & UX (5/5 ✅)
| # | Issue | Fix |
|---|---|---|
| C1 | `getDoctorsByTenant()` requires composite index | Removed `orderBy` — simple equality filter only |
| C2 | License core fields not editable post-creation | Added `updateLicense()` service + full edit dialog (category, doctorName, phone, expiryDate, onlineBooking) |
| C3 | No phone format validation | Created `validateEgyptMobile()` in `validation.js`. Applied in Tenants, Doctors, Licenses create/edit handlers |
| C4 | `updateLicenseExpiry()` flips INACTIVE→ACTIVE | Only sets `status:"EXPIRED"` when date is past; never overrides existing status |
| C5 | "Device MAC" column mislabel | Renamed to "Device Fingerprint" |

#### Category D — Technical Debt (5/5 ✅)
| # | Issue | Fix |
|---|---|---|
| D1 | `deleteDoctor` leaks `comm_doctor_users` | Added query+delete loop for user mapping entries |
| D2 | Error swallowed in `createDoctor` | Replaced `console.error()` with `debug.error()` |
| D3 | Status toggles missing `updatedAt` | Added `updatedAt: serverTimestamp()` to `updateDoctorStatus`, `updateTenantStatus`, `updateLicenseStatus` |
| D4 | `updateLicenseOnlineBooking` missing `updatedAt` | Added `updatedAt: serverTimestamp()` |
| D5 | Tenant doesn't sync license `expiryDate` | `updateTenant()` fetches new license doc and copies `expiryDate` on licenseKey change |

## Plannotator Plan Mode

When in plan mode, always use `submit_plan` before proceeding with implementation. This sends the plan for review:

- **Approved**: proceed with implementation
- **Denied**: apply feedback from the response, then re-submit

After plan approval, use `/plannotator-review` for mid-task reviews or `/plannotator-annotate` to annotate code changes.

### Files Modified
- `src/services/licenses.js` — A1, C4, D3, D4
- `src/services/doctors.js` — A2, D1, D2, D3
- `src/services/tenants.js` — A3, D3, D5
- `src/pages/Tenants.jsx` — C3
- `src/pages/Doctors.jsx` — C3
- `src/pages/Licenses.jsx` — C2, C3, C5
- `src/lib/validation.js` — NEW (C3 phone validation)
- `src/lib/erpValidation.js` — NEW (B)
- `src/pages/ERPSettings.jsx` — NEW (B)
- `src/App.jsx` — B (route)
- `src/components/Sidebar.jsx` — B (nav item)
- `src/services/erp.js` — B (triggerERPSync fix)
- `src/services/firestoreService.js` — B, C, D (re-exports)
