# PROJECT_MAP — clinic-admin

## TECH_STACK

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | — |
| Bundler | Vite + Rolldown | 8.0.9 |
| Framework | React | 19.2.5 |
| Router | React Router DOM | 7.14.2 |
| UI | MUI Material | 9.0.0 |
| Icons | lucide-react | 1.14.0 |
| Backend | Firebase (Auth + Firestore) | 12.12.1 |
| Admin SDK | firebase-admin | 13.8.0 |
| Email | nodemailer | 8.0.7 |
| Storage | Cloudinary (unsigned upload) | — |
| Deploy | Vercel (SPA + serverless functions) | — |
| Linter | ESLint 9 + react-hooks plugin | — |

## SYSTEM_FLOW

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Login      │────▶│  Auth Guard  │────▶│  Sidebar Layout  │
│  /register  │     │  (Firebase)  │     │  (persistent)    │
└─────────────┘     └──────────────┘     └────────┬─────────┘
                                                  │
                    ┌──────────┬──────────┬───────┴───────┬──────────┐
                    ▼          ▼          ▼               ▼          ▼
               /tenants   /doctors   /licenses      /settings   /login(catch)
                    │          │          │               │
                    ▼          ▼          ▼               ▼
              saas_tenants  saas_   saas_licenses   config/
              ──────────▶   doctors                 saas_settings
              comm_tenants  comm_
                            doctors
```

**Auth Flow (Register)**: User fills email/password → POST `/api/admin/register-request` → Owner gets OTP via email → User enters OTP → POST `/api/admin/register-verify` → Firebase Auth user created with `admin: true` claim.

**Dual-Write Pattern**: Tenants and Doctors write to both `saas_*` (admin scope) and `comm_*` (community/public app scope). Status changes sync `active`/`visibility` fields automatically.

**i18n Pattern**: All user-facing text fields stored as `{ en: "...", ar: "..." }`. The `BilingualInput` component renders side-by-side EN/AR inputs. Helper functions (`getLang`, `createBilingual`, `isBilingual`) handle normalization and display.

## ARCHITECTURE

```
clinic-admin/
├── src/
│   ├── main.jsx                  # Entry point
│   ├── App.jsx                   # Router + RequireAuth guard + SidebarLayout
│   ├── firebase.js               # Firebase client SDK init (VITE_ env vars)
│   ├── components/
│   │   └── Sidebar.jsx           # Fixed left nav, nav config, logout
│   ├── pages/
│   │   ├── Login.jsx             # Firebase email/password login
│   │   ├── AdminRegister.jsx     # 2-step OTP registration (→ Vercel API)
│   │   ├── Tenants.jsx           # CRUD: name(EN/AR), address(EN/AR), city(EN/AR), description(EN/AR), plan, status
│   │   ├── Doctors.jsx           # CRUD: name(EN/AR), specialization, bio(EN/AR), education(EN/AR), city(EN/AR), address(EN/AR), photo upload, password, tenant FK
│   │   ├── Licenses.jsx          # CRUD: licenseKey, doctorName(EN/AR), phone, expiryDate, status, deviceId
│   │   ├── Settings.jsx          # appName(EN/AR), support contacts, feature flags, webhook, SMTP
│   │   └── components/
│   │       └── ProtectedRoute.jsx # Unused (App.jsx uses RequireAuth)
│   ├── services/
│   │   └── firestoreService.js   # All Firestore ops — dual-write, sync, rollback
│   └── lib/
│       ├── i18n.jsx              # Bilingual helpers + BilingualInput component
│       ├── cloudinary.js         # Unsigned image upload to Cloudinary
│       ├── collections.js        # Collection constants (UNUSED)
│       └── firestore.js          # Legacy Firestore helpers (UNUSED — uses process.env)
├── api/admin/
│   ├── register-request.js       # Generate OTP, email owner via nodemailer
│   └── register-verify.js        # Verify OTP, create Firebase user + admin claims
├── vercel.json                   # SPA rewrites + serverless function config
└── .env.example                  # Firebase config template (VITE_ prefix)
```

## COLLECTIONS

| Collection | Purpose | i18n Fields |
|---|---|---|
| `saas_tenants` | Admin tenant records | `name`, `address`, `city`, `description` |
| `comm_tenants` | Public mirror (customer app) | `name`, `address`, `city`, `description` |
| `saas_doctors` | Admin doctor records | `name`, `specialization`, `bio`, `education`, `city`, `address`, `tenantName` |
| `comm_doctors` | Public mirror (customer app) | `name`, `specialty`, `bio`, `education`, `city`, `address`, `clinicName`, `languages` |
| `saas_licenses` | License keys | `doctorName` |
| `saas_settings/config` | Global platform config | `appName` |
| `comm_doctor_users` | Doctor auth mapping | — |
| `comm_patients` | Patient records | depends on customer app |
| `comm_appointments` | Appointments | depends on customer app |
| `sync_queue` | Offline sync queue | — |
| `clinic_servers` | Registered servers | — |
| `saas_otp_requests` | OTP verification | — |
| `admins` | Admin profiles | — |

## SPECIALIZATIONS (EN/AR lookup)

| Key | EN | AR |
|---|---|---|
| `general_practice` | General Practice | طب عام |
| `internal_medicine` | Internal Medicine | طب باطني |
| `pediatrics` | Pediatrics | طب أطفال |
| `cardiology` | Cardiology | طب القلب |
| `dermatology` | Dermatology | طب جلدية |
| `orthopedics` | Orthopedics | جراحة عظام |
| `neurology` | Neurology | طب أعصاب |
| `ophthalmology` | Ophthalmology | طب عيون |
| `ent` | ENT | أنف وأذن وحنجرة |
| `psychiatry` | Psychiatry | طب نفسي |
| `dentistry` | Dentistry | طب أسنان |
| `gynecology` | Gynecology | نساء وتوليد |
| `general_surgery` | General Surgery | جراحة عامة |
| `urology` | Urology | جراحة مسالك |
| `anesthesia` | Anesthesiology | تخدير |
| `radiology` | Radiology | أشعة |
| `pathology` | Pathology | باثولوجيا |
| `other` | Other | أخرى |

## ORPHANS & PENDING

### Dead Code (pre-existing, not removed)
| File | Issue |
|---|---|
| `src/lib/firestore.js` | Uses `process.env` (Next.js style), never imported — should be deleted |
| `src/lib/collections.js` | Collection constants never imported — should be deleted |
| `src/pages/components/ProtectedRoute.jsx` | Unused — `App.jsx` uses `RequireAuth` |
| `src/lib/i18n.jsx` - `BilingualInput` | `margin` and `fullWidth` props removed (unused) |

### Known Lint Warnings (pre-existing, not from our changes)
| File | Issue |
|---|---|
| `src/components/Sidebar.jsx:161` | `_` catch variable unused |
| `src/pages/Doctors.jsx:502` | `load` accessed before declaration (existing pattern) |
| `src/pages/Doctors.jsx:641` | `e` event parameter unused |
| `src/pages/Licenses.jsx:129` | `loadLicenses` accessed before declaration (existing pattern) |
| `src/pages/Tenants.jsx:176` | `load` accessed before declaration (existing pattern) |
| `src/services/firestoreService.js:219,346,353` | Unused destructured vars (existing) |

### Missing Doctor Fields (not in current UI but in sync allowlist)
| Field | Status |
|---|---|
| `workingDays` | Empty/default — no UI form field |
| `timeSlots` | Empty/default — no UI form field |
| `languages` | Empty array — no UI form field |

### Build Warning
| Issue | Details |
|---|---|
| Large chunk (932KB) | Single bundle exceeds 500KB — consider code splitting |

## CHANGE LOG

| Date | Change | Files |
|---|---|---|
| 2026-05-07 | EN/AR bilingual support added | `i18n.jsx` (new), `firestoreService.js`, `Tenants.jsx`, `Doctors.jsx`, `Licenses.jsx`, `Settings.jsx` |
| 2026-05-07 | Tenants form: added `city`, `description` bilingual fields | `Tenants.jsx` |
| 2026-05-07 | Doctors form: added `bio`, `education`, `city`, `address`, `yearsOfExperience` bilingual fields | `Doctors.jsx` |
| 2026-05-07 | Specializations converted to EN/AR lookup table (18 items) | `Doctors.jsx` |
| 2026-05-07 | Tenant stats: replaced unused "Enterprise" with "Pro" count | `Tenants.jsx` |
| 2026-06-23 | Phase 17C: ERP Integration (additive fields, ERPSettings page, plan templates, validation) | ERPSettings.jsx (new), licenseTemplates.js (new), erpValidation.js (new), irestoreService.js, Sidebar.jsx, App.jsx |
| 2026-05-07 | Dual-write builders updated for `{en, ar}` structure | `firestoreService.js` |
