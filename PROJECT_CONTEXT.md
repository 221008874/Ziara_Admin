# PROJECT_CONTEXT — Smart Clinic Admin Panel

> **Purpose:** This file contains complete project analysis. An AI model reading this file should understand the entire codebase without needing to read individual source files.

---

## 1. OVERVIEW

**What it is:** A SaaS admin dashboard for managing a multi-tenant smart clinic platform. The admin creates/manages clinics (tenants), doctors, and licenses. Data is mirrored to `comm_*` collections for a customer-facing community app.

**Stack:**
| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js (ESM) | — |
| Bundler | Vite + Rolldown | 8.0.9 |
| Framework | React (JSX, no TypeScript) | 19.2.5 |
| Router | React Router DOM v7 | 7.14.2 |
| UI | MUI Material | 9.0.0 |
| Icons | lucide-react | 1.14.0 |
| Backend | Firebase Auth + Firestore (client SDK) | 12.12.1 |
| Admin SDK | firebase-admin (serverless API routes) | 13.8.0 |
| Email | nodemailer (Gmail SMTP) | 8.0.7 |
| Image Storage | Cloudinary (unsigned upload) | — |
| Deploy | Vercel (SPA + serverless functions) | — |
| Linter | ESLint 9 + react-hooks plugin | — |

**Key Architectural Patterns:**
- **Dual-Write:** Tenants/Doctors write to both `saas_*` (admin) and `comm_*` (community app) collections simultaneously
- **i18n `{en, ar}`:** All user-facing text stored as `{ en: "...", ar: "..." }` objects
- **Firebase Auth + Custom Claims:** Admin users get `{ admin: true }` claim
- **OTP Registration:** New admin requests → owner gets OTP via email → OTP verification creates Firebase user

---

## 2. FILE STRUCTURE

```
clinic-admin/
├── index.html                          # Entry HTML - Google Fonts (Inter + Cairo), logo.png favicon
├── vite.config.js                      # Default Vite + React plugin
├── vercel.json                         # SPA rewrites + api/*.js serverless functions
├── package.json                        # Dependencies (see section 1)
├── eslint.config.js                    # ESLint 9 flat config
├── .env.example                        # VITE_FIREBASE_* vars template
├── PROJECT_MAP.md                      # Architecture overview + change log
├── PROJECT_CONTEXT.md                  # THIS FILE - complete analysis for AI context
│
├── public/
│   ├── logo.png                        # App favicon + logo
│   ├── favicon.svg                     # (unused)
│   └── icons.svg                       # (unused)
│
├── src/
│   ├── main.jsx                        # React 19 createRoot → <App />
│   ├── App.jsx                         # BrowserRouter + Routes + RequireAuth + SidebarLayout + SidebarCtx
│   ├── index.css                       # Global CSS vars, scrollbar, animations, responsive utilities
│   ├── firebase.js                     # Firebase client init (VITE_ env vars) → exports db, auth
│   │
│   ├── components/
│   │   └── Sidebar.jsx                 # Fixed left nav (240px), logo, nav items, user box, logout
│   │                                   # Exports: default Sidebar({onToggle}), Hamburger({onClick})
│   │                                   # Responsive: slides in/out on mobile with overlay
│   │
│   ├── pages/
│   │   ├── Login.jsx                   # Firebase email/password login → navigate("/")
│   │   ├── AdminRegister.jsx           # 2-step: (1) email+password → POST /api/admin/register-request
│   │   │                               #          (2) OTP → POST /api/admin/register-verify → /login
│   │   ├── Tenants.jsx                 # CRUD clinics: name(EN/AR), address(EN/AR), city(EN/AR), description(EN/AR), plan, contactEmail, contactPhone, status
│   │   ├── Doctors.jsx                 # CRUD doctors: name(EN/AR), specialization, bio(EN/AR), education(EN/AR), city(EN/AR), address(EN/AR), phone, email, photoUrl, password, tenantId, licenseKey, yearsOfExperience
│   │   ├── Licenses.jsx                # CRUD licenses: licenseKey, doctorName(EN/AR), phone, expiryDate, status, deviceId
│   │   ├── Settings.jsx                # Global config: appName(EN/AR), supportEmail, supportPhone, feature flags, webhook, SMTP
│   │   └── components/
│   │       └── ProtectedRoute.jsx      # UNUSED - uses localStorage check (App.jsx uses RequireAuth instead)
│   │
│   ├── services/
│   │   └── firestoreService.js         # ALL Firestore operations (942 lines
	\t\t\t\t\t\t# Dual-write for tenants/doctors, rollback on error
	\t\t\t\t\t\t# ERP SaaS integration: getTenantById, updateTenantERPFields, getLicenseByKey, updateLicenseERPFields, migrateERPFields, getERPEnrichedTenants)
│   │                                   # Dual-write for tenants/doctors, rollback on error
│   │
│   ├── lib/
│   │   ├── i18n.jsx                    # Bilingual helpers + BilingualInput MUI component
│   │   ├── cloudinary.js               # uploadImageToCloudinary(file, folder) → URL
│   │   ├── collections.js              # UNUSED - collection name constants
│   │   └── firestore.js                # UNUSED - legacy helpers using process.env (Next.js style)
│   │
│   └── assets/
│       ├── logo.png                    # Brand logo
│       └── hero.png                    # (unused in current code)
│
├── api/admin/
│   ├── register-request.js             # POST: generate OTP, store hash, email owner via nodemailer
│   └── register-verify.js              # POST: verify OTP hash, create Firebase user, set admin claim
```

---

## 3. AUTHENTICATION FLOW

### Login
```
User enters email + password
  → signInWithEmailAndPassword(auth, email, password)
  → getIdTokenResult() → check custom claims
  → Navigate to "/" (redirects to /tenants)
```

### Registration (2-step OTP)
```
Step 1 - Request:
  POST /api/admin/register-request { email, password }
  → Generate 6-digit OTP
  → Hash OTP (SHA-256)
  → Store in saas_otp_requests/{email}: { otpHash, expiry (10min), attempts: 0 }
  → Send email to OWNER_EMAIL with OTP via nodemailer (Gmail SMTP)
  → Response: { success: true, message }

Step 2 - Verify:
  POST /api/admin/register-verify { email, otp, fullName, password }
  → Lookup otpDoc by email
  → Check expiry, check attempts < 5
  → Hash input OTP, compare with stored otpHash
  → Check email not already in Firebase Auth
  → auth.createUser({ email, password, displayName: fullName, emailVerified: true })
  → auth.setCustomUserClaims(uid, { admin: true })
  → Add uid to saas_settings/config adminUids array
  → Create admins/{uid} doc: { email, fullName, role: "admin" }
  → Delete otpDoc
  → Response: { success: true, uid }
```

### Auth Guard (App.jsx)
```jsx
<RequireAuth> → onAuthStateChanged(auth, callback) → if user: render children, else: <Navigate to="/login" />
```

---

## 4. FIRESTORE COLLECTIONS (13 total)

| Collection | Purpose | Written By | i18n Fields |
|---|---|---|---|
| `saas_tenants` | Admin tenant records | Admin panel | `name`, `address`, `city`, `description` |
| `comm_tenants` | Public mirror (community app reads) | Auto-synced from saas_tenants | Same |
| `saas_doctors` | Admin doctor records | Admin panel | `name`, `specialization`, `bio`, `education`, `city`, `address`, `tenantName` |
| `comm_doctors` | Public mirror (community app reads) | Auto-synced from saas_doctors | `name`, `specialty`, `bio`, `education`, `city`, `address`, `clinicName`, `languages` |
| `saas_licenses` | License key management | Admin panel | `doctorName` |
| `config/saas_settings` | Global platform config (single doc) | Admin panel (Settings.jsx) | `appName` |
| `comm_doctor_users` | Doctor Firebase Auth mapping | Auto (on doctor create) | — |
| `comm_patients` | Patient records | Community app | varies |
| `comm_appointments` | Appointments | Community app | varies |
| `sync_queue` | Offline sync queue items | Auto | — |
| `clinic_servers` | Registered clinic servers | Auto | — |
| `saas_otp_requests` | OTP verification requests | API routes | — |
| `admins` | Admin profiles | API routes (register-verify) | — |

---

## 5. DUAL-WRITE PATTERN

When admin creates/updates/deletes a **Tenant** or **Doctor**, the system writes to BOTH collections:

### Create Tenant
```js
// 1. Write to saas_tenants
const saasRef = await addDoc(collection(db, COLLECTIONS.SAAS_TENANTS), { ...data, status: "ACTIVE", createdAt: serverTimestamp() });

// 2. Mirror to comm_tenants
const publicTenant = buildPublicTenant({ ...data, status: "ACTIVE" }, saasRef.id);
await setDoc(doc(db, COLLECTIONS.COMM_TENANTS, saasRef.id), publicTenant);
```

### Create Doctor (with rollback)
```js
// 1. Write to saas_doctors
// 2. Create Firebase Auth user (if email+password provided)
// 3. Create comm_doctor_users mapping
// 4. Mirror to comm_doctors via buildPublicDoctor()
// 5. Ensure tenant exists in comm_tenants
// On error: rollback Auth user + delete saas_doctors doc
```

### Update Status (Tenant or Doctor)
```js
// 1. Update saas_* collection
// 2. Sync active/visibility to comm_* collection
```

### Delete Tenant
```js
// 1. Delete from saas_tenants
// 2. Delete from comm_tenants
// 3. Hide all associated doctors in comm_doctors (set active:false, visibility:"HIDDEN")
```

---

## 6. I18N SYSTEM (EN/AR Bilingual)

### Data Structure
Every user-facing text field is stored as:
```js
{ en: "Al-Noor Clinic", ar: "عيادة النور" }
```

### Helper Functions (`src/lib/i18n.jsx`)
```js
createBilingual(en = "", ar = "")     // → { en, ar }
isBilingual(value)                     // → boolean: checks if value is {en, ar} object
getLang(field, lang = "en")            // → string: extracts the language value, handles legacy strings
updateBilingual(field, lang, value)    // → {en, ar}: updates one language in the object
```

### BilingualInput Component
React component rendering two side-by-side input fields (EN left, AR right with `dir="rtl"`). Used in all forms.

### Normalization (firestoreService.js)
```js
function normalizeBilingual(raw, fallbackEn, fallbackAr) {
  if (isBilingual(raw)) return raw;         // Already bilingual
  if (typeof raw === "string") return createBilingual(raw, raw); // Legacy: copy to both
  return createBilingual(fallbackEn, fallbackAr);                // Empty fallback
}
```

### Builder Functions (auto-sync)
- `buildPublicDoctor(data, doctorId)` — converts saas_doctors → comm_doctors format, normalizes all bilingual fields
- `buildPublicTenant(data, tenantId)` — converts saas_tenants → comm_tenants format, normalizes all bilingual fields

### Specializations Lookup (Doctors.jsx)
18-item array with `{ value, en, ar }` pairs:
```
general_practice, internal_medicine, pediatrics, cardiology, dermatology,
orthopedics, neurology, ophthalmology, ent, psychiatry, dentistry,
gynecology, general_surgery, urology, anesthesia, radiology, pathology, other
```

---

## 7. ROUTING

```
/login          → Login.jsx                    (public)
/register       → AdminRegister.jsx            (public)
/               → Navigate to /tenants         (protected)
/tenants        → Tenants.jsx                  (protected, default page)
/doctors        → Doctors.jsx                  (protected)
/licenses       → Licenses.jsx                 (protected)
/settings       → Settings.jsx                 (protected)
/erp-settings    ? ERPSettings.jsx              (protected, ERP integration config)
*               → Navigate to /login           (catch-all)
```

### Protected Layout
```
<SidebarLayout>
  <Sidebar />       ← Fixed left nav, 240px on desktop, slide-in on mobile
  <Outlet />        ← Current page renders here with marginLeft: {xs:0, md:"240px"}
</SidebarLayout>
```

### Sidebar Context
```jsx
// App.jsx exports: SidebarCtx = createContext({open, toggle}), useSidebar()
// Pages access: const { toggle } = useSidebar()
// Sidebar receives: <Sidebar onToggle={toggle} />
// Hamburger button: <Hamburger onClick={toggle} /> (visible only on mobile)
```

---

## 8. UI/UX PATTERNS

### Design Tokens (CSS variables in index.css)
```css
--bg-primary: #04091a;      // Main background
--bg-secondary: #0b1628;    // Card backgrounds
--bg-input: #0f1e36;        // Input backgrounds
--accent: #0fb8a6;          // Primary teal accent
--accent-light: #2dd4bf;    // Light teal
--accent-dark: #0d9488;     // Dark teal
--text-primary: #eaf2ff;    // Main text
--text-secondary: #dde6f0;  // Secondary text
--text-muted: #6a8aaa;      // Muted text
--text-dark: #3a5070;       // Labels/hints
--success: #34d399;         // Active/green
--danger: #f87171;          // Inactive/red
--warning: #fbbf24;         // Warning/amber
--border-subtle: rgba(15,184,166,0.12);
```

### Common Page Structure
```
PageContainer (min-height:100vh, bg:#04091a, margin-left responsive)
├── Background glows (radial-gradient blur circles)
├── TopBar (gradient header with logo + title + action button)
│   ├── Hamburger (mobile only)
│   ├── Logo (logo.png, responsive size)
│   ├── Title + subtitle
│   └── Action button
└── ContentWrapper (padding 24px)
    ├── Error/Success Alerts
    ├── Stats Row (responsive grid: 4→2→1 columns)
    └── GlassPanel (card with border, table inside table-responsive div)
```

### Responsive Breakpoints
- **Desktop (>768px):** Sidebar visible (240px), full stats grid (4 cols), all labels visible
- **Mobile (≤768px):** Sidebar hidden (hamburger toggle), stats 1 col, abbreviated labels, smaller buttons

### Form Dialogs
- `maxWidth="md"` for create/edit dialogs
- `fullScreen` on mobile via `sx={{ "& .MuiDialog-paper": { maxHeight: "100vh" } }}`
- BilingualInput renders two side-by-side fields (stacks on mobile)

### Table Layout
- Wrapped in `<div className="table-responsive">` for horizontal scroll on mobile
- Custom styled rows with hover effects, alternating backgrounds
- Status badges (chips with color coding)

---

## 9. API ROUTES (Vercel Serverless)

### POST /api/admin/register-request
- **Input:** `{ email, password }`
- **Process:** Generate OTP → hash → store → email owner
- **Output:** `{ success: true }` or `{ error }`
- **Dependencies:** nodemailer, firebase-admin (Firestore + Auth)

### POST /api/admin/register-verify
- **Input:** `{ email, otp, fullName, password }`
- **Process:** Verify OTP hash → create Firebase user → set admin claim → create admin profile
- **Output:** `{ success: true, uid }` or `{ error }`
- **Dependencies:** firebase-admin (Auth + Firestore)

### Environment Variables Required for API
```
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64  # Base64-encoded service account JSON
GMAIL_USER                            # Gmail address for sending OTP emails
GMAIL_APP_PASSWORD                    # Gmail app-specific password
OWNER_EMAIL                           # Owner email to receive OTP notifications
```

---

## 10. FIRESTORE SERVICE FUNCTIONS (Complete List)

### Licenses
| Function | Input | Output | Description |
|---|---|---|---|
| `createLicense` | `{ licenseKey, doctorName, phone, expiryDate }` | void | Create with doc ID = licenseKey |
| `getAllLicenses` | — | `License[]` | Ordered by createdAt desc |
| `updateLicenseStatus` | `(docId, newStatus)` | void | Toggle ACTIVE/INACTIVE |
| `updateLicenseExpiry` | `(licenseKey, newExpiryDate)` | void | Update expiry + set ACTIVE |

### Tenants (Dual-Write)
| Function | Input | Output | Description |
|---|---|---|---|
| `createTenant` | `{ name, contactEmail, contactPhone, address, city, description, plan }` | `id` | Writes to saas_tenants + comm_tenants |
| `getAllTenants` | — | `Tenant[]` | From saas_tenants, ordered by createdAt desc |
| `updateTenantStatus` | `(tenantId, newStatus)` | void | Updates both collections, syncs active/visibility |
| `updateTenant` | `(tenantId, updates)` | void | Updates saas + syncs allowed fields to comm |
| `deleteTenant` | `(tenantId)` | void | Deletes from both, hides associated doctors in comm |

### Doctors (Dual-Write)
| Function | Input | Output | Description |
|---|---|---|---|
| `createDoctor` | `{ name, phone, email, specialization, tenantId, tenantName, licenseKey, photoUrl, password, bio, education, city, address, yearsOfExperience }` | `id` | Creates saas + Auth + comm_doctor_users + comm_doctors + ensures comm_tenants |
| `getAllDoctors` | — | `Doctor[]` | From saas_doctors |
| `getPublicDoctors` | — | `Doctor[]` | From comm_doctors (active + public only) |
| `getDoctorsByTenant` | `(tenantId)` | `Doctor[]` | From saas_doctors filtered by tenant |
| `updateDoctorStatus` | `(doctorId, newStatus)` | void | Updates both collections |
| `updateDoctor` | `(doctorId, updates)` | void | Updates saas + syncs allowed fields to comm |
| `deleteDoctor` | `(doctorId)` | void | Deletes from saas_doctors + comm_doctors |

### Patients & Appointments (Community)
| Function | Description |
|---|---|
| `createPatient` | Set doc by phone number in comm_patients |
| `lookupPatient` | Get doc by phone from comm_patients |
| `createAppointment` | Add to comm_appointments with status:SCHEDULED |
| `getAppointmentsByPatient` | Query by patientPhone, optionally filtered by tenantId |
| `getUnsyncedAppointments` | Pagination query for synced:false items |

### Sync Queue
| Function | Description |
|---|---|
| `queueSyncAppointment` | Add PENDING item to sync_queue |
| `getPendingSyncItems` | Query PENDING/FAILED items with retryCount < 5 |
| `markSyncComplete` | Delete queue item on success |
| `markSyncFailed` | Update status to FAILED, increment retryCount |

### Server Registration
| Function | Description |
|---|---|
| `registerClinicServer` | Set doc by MAC address in clinic_servers |
| `updateServerHeartbeat` | Update + set lastSeen timestamp |
| `getServerByLicense` | Query online server by licenseKey |

---

## 11. CLOUDINARY INTEGRATION

```js
// src/lib/cloudinary.js
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadImageToCloudinary = async (file, folder = "doctors/profiles") => {
  // Validates image type, checks <5MB
  // POSTs to https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload
  // FormData: file, upload_preset, folder
  // Returns secure_url
};
```

---

## 12. KEY CODE PATTERNS

### Page Component Pattern
```jsx
export default function PageName() {
  const { toggle } = useSidebar();          // Mobile sidebar toggle
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => { load(); }, []);
  
  const load = async () => { /* fetch + set state */ };
  
  // CRUD handlers: handleCreate, handleEdit, handleDelete, toggleStatus
  
  return (
    <PageContainer>
      <TopBar>
        <Hamburger onClick={toggle} />       {/* Mobile only */}
        <Logo img src={logo} />              {/* All pages */}
        <Title />
        <ActionButton />
      </TopBar>
      <ContentWrapper>
        <StatsGrid />                        {/* Responsive grid */}
        <GlassPanel>
          <div className="table-responsive"> {/* Horizontal scroll on mobile */}
            <Table>...</Table>
          </div>
        </GlassPanel>
      </ContentWrapper>
      {/* Dialogs */}
    </PageContainer>
  );
}
```

### Form Data Pattern (Bilingual)
```jsx
const BLANK = {
  name: createBilingual(),        // { en: "", ar: "" }
  address: createBilingual(),
  contactEmail: "",               // Non-translatable: plain string
  plan: "BASIC",                  // Enum: plain string
};

// Open edit: normalize legacy strings to bilingual
const openEdit = (item) => {
  setEditData({
    name: isBilingual(item.name) ? item.name : createBilingual(item.name || ""),
    contactEmail: item.contactEmail || "",
  });
};
```

---

## 13. ENVIRONMENT VARIABLES

### Client (VITE_ prefix — safe for browser)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_CLOUDINARY_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET
```

### Server (API routes — server-side only)
```
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
GMAIL_USER
GMAIL_APP_PASSWORD
OWNER_EMAIL
```

---

## 14. DEAD CODE (Known, Not Removed)

| File | Reason | Should Be |
|---|---|---|
| `src/lib/firestore.js` | Uses `process.env` (Next.js style), never imported | Deleted |
| `src/lib/collections.js` | Collection constants, never imported | Deleted |
| `src/pages/components/ProtectedRoute.jsx` | Unused (App.jsx uses RequireAuth) | Deleted |
| `src/assets/vite.svg` | Replaced by logo.png | Deleted |
| `src/assets/react.svg` | Replaced by logo.png | Deleted |
| `public/favicon.svg` | Replaced by logo.png | Deleted |
| `src/assets/hero.png` | Not referenced in any component | Delete or use |

---

## 15. KNOWN LINT WARNINGS (Pre-existing)

These existed before any changes and are not blocking:
- `react-hooks/immutability`: `load()` accessed before declaration in Tenants/Doctors/Licenses (existing pattern)
- `no-unused-vars`: `_` catch variable in Sidebar.jsx
- `no-unused-vars`: Unused destructured vars in firestoreService.js
- `react-refresh/only-export-components`: i18n.jsx exports helpers + component (eslint disabled)
- Large bundle warning (932KB) — single chunk exceeds 500KB

---

## 16. BUILD COMMANDS

```bash
npm run dev       # Vite dev server
npm run build     # Vite production build → dist/
npm run lint      # ESLint
npm run preview   # Preview production build
```

---

## 17. VERCEL DEPLOYMENT

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": { "api/**/*.js": { "maxDuration": 10 } },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- SPA routing handled by rewrite to index.html
- API routes (`/api/admin/*`) run as serverless functions (10s timeout)
- Environment variables must be set in Vercel dashboard

---

## 18. CUSTOMIZATION GUIDE FOR AI

When working with this codebase:

1. **Adding a new page:** Create in `src/pages/`, add route in `App.jsx`, add nav item in `Sidebar.jsx` NAV_ITEMS
2. **Adding a bilingual field:** Use `createBilingual()` in BLANK, `<BilingualInput>` in forms, add to sync allowlist in firestoreService.js
3. **Adding a new Firestore collection:** Add constant to COLLECTIONS in firestoreService.js, create CRUD functions
4. **Modifying table columns:** Edit the `<TableHead>` and `<TableBody>` in the page component
5. **Changing colors:** Edit CSS variables in `index.css` or component styled definitions
6. **Adding responsive behavior:** Use MUI `sx={{ xs: ..., sm: ..., md: ... }}` or CSS utility classes (`.hide-on-mobile`, `.hide-on-tablet`, `.stats-grid`)
7. **API route:** Add `.js` file in `api/admin/`, follow CORS pattern + JSON parsing from existing routes

---

## 19. ERP INTEGRATION (Phase 17C)

### Purpose
Extend the Admin Panel with ERP SaaS metadata configuration UI. The ERP system reads tenant/license data from smartclinicadmin Firestore to enforce login, user limits, and doctor limits.

### Key Principle
**Additive only** — no field removal, collection rename, document ID change, or API break.

### Collections (additive fields only)
| Collection | Additive Fields | Purpose |
|---|---|---|
| saas_tenants | erpEnabled (default: false) | ERP opt-in per tenant |
| saas_licenses | 	enantId, plan, maxUsers, maxDoctors, enabledModules | ERP limit enforcement |

### Plan Templates (src/lib/licenseTemplates.js)
| Plan | maxUsers | maxDoctors | enabledModules |
|---|---|---|---|
| BASIC | 5 | 2 | patients, appointments |
| PRO | 20 | 10 | patients, appointments, payments, reports |
| ENTERPRISE | -1 (unlimited) | -1 (unlimited) | * (all) |

### New Files
| File | Purpose |
|---|---|
| src/pages/ERPSettings.jsx | ERP config page: tenant table, configure dialog, migration |
| src/lib/licenseTemplates.js | Plan definitions, getPlanTemplate(), applyPlanTemplate(), ALL_MODULES, MODULE_LABELS |
| src/lib/erpValidation.js | Validation: validateExpiryDate, validateLimit, validatePlan, validateModules, validateERPSettings |

### Modified Files
| File | Changes |
|---|---|
| src/services/firestoreService.js | Added getTenantById, updateTenantERPFields, getLicenseByKey, updateLicenseERPFields, migrateERPFields, getERPEnrichedTenants |
| src/components/Sidebar.jsx | Added "ERP Integration" section with "/erp-settings" nav item |
| src/App.jsx | Added import + Route for ERPSettings |

### ERPSettings Page Features
- Stats row: Total Tenants, ERP Enabled, ERP Disabled, Active
- Tenant table: Name, Plan, Status, ERP Enabled, User Limit, Doctor Limit, Modules, Configure
- Configure Dialog: Tenant Status, ERP toggle, Plan (auto-populates limits), License Status, Expiration, User/Doctor limits (manual override), Module toggles
- Migration button (idempotent — adds missing fields only)
- Full validation via erpValidation.js

### Sidebar NAV_ITEMS
`js
{
  section: "ERP Integration",
  items: [
    { to: "/erp-settings", icon: "⚡", label: "ERP Settings" },
  ],
}
`

### Related ERP Project (Ziara_WEP_ERP)
The ERP project reads smartclinicadmin Firestore collections (read-only, community Admin SDK):
- saas_tenants: tenant status, plan, erpEnabled
- saas_licenses: plan, maxUsers, maxDoctors, enabledModules, status, expiresAt
- Enforces limits via LimitEnforcer, validates login via auth.service.ts

