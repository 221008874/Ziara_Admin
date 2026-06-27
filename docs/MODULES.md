# Modules / Screens

---

## 1. Login (/login)

**File:** src/pages/Login.jsx (302 lines)

### Purpose
Email/password authentication for admin users.

### UI Elements
- Email text field (MUI TextField)
- Password text field (MUI TextField with visibility toggle)
- "Sign in" button (MUI LoadingButton)
- Link to /register for new admin registration
- Ziara branding (logo, app name, gradient tagline)

### Data Flow
1. User submits email + password
2. signInWithEmailAndPassword(auth, email, password)
3. On success: user.getIdToken(true) + getIdTokenResult() (checks custom claims)
4. Navigate to "/" (which redirects to /tenants)
5. On error: display Firebase error message

### States
- idle: Login form displayed
- loading: Button shows MUI CircularProgress (size=20), form fields disabled
- error: Red alert banner with error message
- success: Navigate to /

### Edge Cases
- Network error: "Network error. Please check your connection."
- Invalid credentials: Firebase error message displayed
- Not admin: User may exist but lacks admin custom claim (login still succeeds)

---

## 2. Admin Registration (/register)

**File:** src/pages/AdminRegister.jsx (319 lines)

### Purpose
Two-step admin registration with OTP verification via email.

### Flow

Step 1 — Request:
  Input: Email + Password
  POST /api/admin/register-request { email, password }
  Server: generates 6-digit OTP, stores SHA-256 hash in saas_otp_requests/{email},
          sends OTP to OWNER_EMAIL via Gmail SMTP
  On success: advance to Step 2

Step 2 — Verify:
  Input: OTP (6 digits) + Full Name
  POST /api/admin/register-verify { email, otp, fullName, password }
  Server: verifies OTP hash, checks expiry (10 min), checks attempts (< 5),
          creates Firebase Auth user with admin:true claim,
          adds UID to saas_settings/config/adminUids,
          creates admins/{uid} document,
          deletes OTP document
  On success: navigate to /login

### UI Elements
- Step indicator (1 > 2) with progress line
- Step 1: email, password (with visibility toggle), confirm password
- Step 2: OTP input (6 separate digit boxes), full name
- Navigation: Back button (step 2 only), Submit button

### States
- step 1 idle: Registration form
- step 1 loading: Submit button loading
- step 1 error: Error alert
- step 2 idle: OTP verification form
- step 2 loading: Verify button loading
- step 2 success: Navigate to /login with success message
- step 2 error: Error alert (invalid OTP, expired, etc.)

### Edge Cases
- OTP expired: "Verification code expired. Please request a new one."
- Too many attempts: "Too many failed attempts."
- Wrong OTP: "Invalid verification code" (increments attempts counter)

---

## 3. Tenants / Clinics (/tenants)

**File:** src/pages/Tenants.jsx (489 lines)

### Purpose
CRUD management of clinic/tenant accounts.

### Default Route
This is the landing page (root "/" redirects here).

### UI Elements
- TopBar: title "Clinics", "Create Clinic" button
- Stats grid (4 StatCards): total, active, inactive, expired counts
- Data table (MUI Table with styled container): name, email, phone, plan, status, license, expiry, actions
- Create/Edit Dialog (MUI Dialog with form fields)
- Delete confirmation dialog

### Form Fields (Create/Edit)
- name (BilingualInput: en + ar)
- contactEmail
- contactPhone
- address (BilingualInput)
- city (BilingualInput)
- description (BilingualInput)
- plan (Select: BASIC / PRO / ENTERPRISE)
- licenseKey
- expiryDate (date picker)

### Data Flow
- Read: getAllTenants() -> ordered by createdAt desc -> saas_tenants
- Create: createTenant() -> set doc in saas_tenants + mirror to comm_tenants
- Update: updateTenant() -> updateDoc saas_tenants + sync selected fields to comm_tenants
- Status: updateTenantStatus() -> updateDoc both collections (active field)
- Delete: deleteTenant() -> delete from both + hide associated comm_doctors

### States
- loading: Skeleton table (6 rows, 6 columns)
- empty: "No clinics yet" EmptyState with CTA
- error: Error alert with retry button
- loaded: Data table + stats

### Edge Cases
- Delete cascades: hides ALL associated comm_doctors records
- Status sync: changing tenant status also updates comm_tenants.active
- License-tenant link: licenseKey field links to Licenses module

---

## 4. Doctors (/doctors)

**File:** src/pages/Doctors.jsx (1163 lines)

### Purpose
CRUD management of doctor accounts with Firebase Auth integration.

### UI Elements
- TopBar: title "Doctors", "Add Doctor" button
- Tenant filter (Select dropdown: All / specific tenant)
- Data table (MUI Table): name, phone, email, specialization, tenant, license, status, photo, actions
- Create/Edit Dialog (MUI Dialog with image upload)
- Delete confirmation dialog

### Form Fields (Create/Edit)
- name (BilingualInput)
- phone
- email (creates Firebase Auth account)
- password (visible only in Create mode)
- specialization (Select from SPECIALIZATIONS list)
- tenantId (Select from tenants list, or "" for individual)
- licenseKey
- photoUrl (Cloudinary upload)
- bio (BilingualInput)
- education (BilingualInput)
- city (BilingualInput)
- address (BilingualInput)
- yearsOfExperience
- languages (empty array, no UI field)

### Missing Fields (no UI but expected by public schema)
- workingDays
- timeSlots

### Data Flow
- Read: getAllDoctors() -> ordered by createdAt desc -> saas_doctors
- Create (complex):
  1. Validate email uniqueness in saas_doctors
  2. Write doc to saas_doctors (generates doc ID = uid)
  3. POST /api/admin/create-doctor-auth { email, password, uid }
  4. On Auth success: write comm_doctor_users/{email}
  5. Mirror doc to comm_doctors via buildPublicDoctor()
  6. Ensure comm_tenants record exists for the tenant
  7. On Auth failure: delete the saas_doctors doc (rollback)
- Update: updateDoctor() -> updateDoc saas_doctors + sync to comm_doctors
- Status: updateDoctorStatus() -> updateDoc both collections
- Delete: deleteDoctor() -> delete from both collections

### States
- loading: Skeleton table
- empty: "No doctors yet" EmptyState
- error: Error alert
- loaded: Data table + optional tenant filter

### Image Upload Flow
1. User selects image file
2. Client-side resize to 800px max via canvas
3. Upload to Cloudinary via uploadImageToCloudinary()
4. Cloudinary returns HTTPS URL
5. URL saved to doctor doc

### SPECIALIZATIONS List
General Practitioner, Cardiologist, Dermatologist, Pediatrician,
Orthopedic, Ophthalmologist, ENT, Neurologist, Psychiatrist,
Dentist, Gynecologist, Urologist, Endocrinologist, Gastroenterologist,
Pulmonologist, Rheumatologist, Oncologist, Radiologist, Anesthesiologist,
Plastic Surgeon, Other

---

## 5. Licenses (/licenses)

**File:** src/pages/Licenses.jsx (466 lines)

### Purpose
Manage software license keys for clinics/doctors.

### UI Elements
- TopBar: title "Licenses", "Issue License" button
- Data table (MUI Table): license key, doctor name, phone, category, expiry, status, online booking, actions
- Issue License Dialog
- Edit Expiry Dialog
- Status toggle (ClickableStatus: ACTIVE / INACTIVE)

### Form Fields (Issue)
- licenseKey (auto-generated: LIC-XXXX-XXX format)
- category (Select: doctor / tenant)
- doctorName (BilingualInput)
- phone
- expiryDate
- onlineBooking (Switch/toggle)

### Data Flow
- Read: getAllLicenses() -> ordered by createdAt desc -> saas_licenses
- Create: createLicense() -> set doc with doc ID = licenseKey
- Status: updateLicenseStatus() -> toggle ACTIVE/INACTIVE
- Expiry: updateLicenseExpiry() -> update + auto-set ACTIVE
- Online Booking: updateLicenseOnlineBooking() -> toggle boolean

### States
- loading: Skeleton rows
- empty: "No licenses issued" EmptyState
- error: Error alert
- loaded: Data table with action buttons

### Edge Cases
- License key follows pattern: LIC-{year}-{3-digit number}
- Changing expiry date also sets status to ACTIVE
- Online booking toggle is independent of license status

---

## 6. Settings (/settings)

**File:** src/pages/Settings.jsx (277 lines)

### Purpose
Global platform configuration stored in saas_settings/config.

### UI Elements
- TopBar: title "Settings"
- Form grid (2-column MUI Grid):
  - appName (BilingualInput)
  - supportEmail, supportPhone
  - defaultLicenseDays, maxDevicesPerLicense
  - graceperiodDays
  - SMTP config: smtpHost, smtpPort, smtpUser, smtpPass
  - webhookUrl
- Toggle switches: allowSelfRegistration, enforceDeviceLock, autoExpireCheck, maintenanceMode
- Save button with success feedback

### Data Flow
- Read: getDoc(saas_settings/config) on mount
- Write: setDoc(saas_settings/config) with all 15 fields + updatedAt timestamp
- On save: show success snackbar, refetch

### States
- loading: Form skeleton (8 placeholder rows)
- saving: Save button shows "Saving..."
- error: Error alert
- success: "Settings saved" snackbar (2s auto-hide)

### Settings Schema (15 fields)
  appName                { en: string, ar: string }
  supportEmail           string
  supportPhone           string
  defaultLicenseDays     number (default: 365)
  maxDevicesPerLicense   number (default: 1)
  allowSelfRegistration  boolean
  enforceDeviceLock      boolean
  autoExpireCheck        boolean
  maintenanceMode        boolean
  graceperiodDays        number (default: 7)
  webhookUrl             string
  smtpHost               string
  smtpPort               string
  smtpUser               string
  smtpPass               string

---

## 7. Updates (/updates)

**File:** src/pages/Updates.jsx (383 lines)

### Purpose
Manage app version releases for Ziara desktop apps (DR, SEC, Server).

### UI Elements
- TopBar: title "Updates"
- Three app cards (MUI Card components):
  - Ziara DR (doctor app)
  - Ziara SEC (receptionist app)
  - Ziara Server (backend server)
- Each card shows: current version, status badge, publish/unpublish button
- Publish Dialog: version, build number, download URL, MSI URL, release notes, min version, force update toggle
- Release History Dialog: table of past versions with delete
- Server instances table: MAC, license, tunnel URL, local IP, status, version, last seen

### Data Flow (6 functions)
- getAppVersions() -> fetch all 3 app docs from app_versions
- publishVersion(appId, data) -> set doc + add to releases subcollection
- unpublishVersion(appId) -> set status to "draft"
- getReleaseHistory(appId, limit) -> query releases subcollection ordered desc
- deleteRelease(appId, version) -> delete from releases subcollection
- getClinicServers() -> all clinic_servers ordered by lastSeen desc

### States
- loading: Skeleton cards (3 cards)
- empty: "No versions published" for each app
- error: Error alert
- loaded: Version cards + publish button

### Publish Version Schema
  appId            "dr" | "sec" | "server"
  version          string (e.g. "2.5.0")
  buildNumber      number
  downloadUrl      string
  msiUrl           string
  releaseNotes     string (markdown)
  releaseDate      string (YYYY-MM-DD)
  minVersion       string
  forceUpdate      boolean
  status           "published" | "draft" | "unpublished"
  fileSize         number (bytes)
  checksum         string (SHA-256)
