# Firestore Schema

## Collection: saas_tenants

Document ID: Auto-generated (Firestore autoId)

Admin source of truth for clinic/tenant accounts.

{
  name:            { en: string, ar: string },
  contactEmail:    string,
  contactPhone:    string,
  address:         { en: string, ar: string },
  city:            { en: string, ar: string },
  description:     { en: string, ar: string },
  plan:            "BASIC" | "PRO" | "ENTERPRISE",
  licenseKey:      string,
  expiryDate:      string,          // "YYYY-MM-DD"
  status:          "ACTIVE" | "INACTIVE",
  createdAt:       Timestamp,
}

Queries: getAllTenants() ordered by createdAt desc

---

## Collection: comm_tenants

Document ID: Same as saas_tenants doc ID

Public mirror of saas_tenants (subset of fields).

{
  id:             string,          // saas_tenants doc ID
  name:           { en: string, ar: string },
  city:           { en: string, ar: string },
  address:        { en: string, ar: string },
  logoUrl:        string,
  description:    { en: string, ar: string },
  active:         boolean,
  visibility:     "PUBLIC" | "HIDDEN",
  _syncedAt:      Timestamp,
  _sourceId:      string,          // saas_tenants doc ID
}

Created via buildPublicTenant() transform.

---

## Collection: saas_doctors

Document ID: Auto-generated (used as uid in create-doctor-auth API)

Admin source of truth for doctor accounts.

{
  name:              { en: string, ar: string },
  phone:             string,
  email:             string,
  specialization:    string,           // key from SPECIALIZATIONS list
  tenantId:          string | "",
  tenantName:        { en: string, ar: string },
  licenseKey:        string,
  photoUrl:          string,           // Cloudinary HTTPS URL
  bio:               { en: string, ar: string },
  education:         { en: string, ar: string },
  city:              { en: string, ar: string },
  address:           { en: string, ar: string },
  yearsOfExperience: string,
  languages:         string[],         // always [] (no UI field)
  status:            "ACTIVE" | "INACTIVE",
  createdAt:         Timestamp,
}

Queries:
  getAllDoctors()        ordered by createdAt desc
  getDoctorsByTenant()   filtered by tenantId

---

## Collection: comm_doctors

Document ID: Same as saas_doctors doc ID

Public mirror for community booking site.

{
  name:              { en: string, ar: string },
  nameEn:            string,
  specialty:         { en: string, ar: string },
  specialtyEn:       string,
  specialtyKey:      string,
  bio:               { en: string, ar: string },
  photoUrl:          string,
  tenantId:          string,
  clinicName:        { en: string, ar: string },
  city:              { en: string, ar: string },
  address:           { en: string, ar: string },
  workingDays:       string[],           // always [] (no UI field)
  timeSlots:         string[],           // always [] (no UI field)
  education:         { en: string, ar: string },
  languages:         { en: string, ar: string }[],  // bilingual array
  yearsOfExperience: number | null,
  active:            boolean,
  visibility:        "PUBLIC" | "HIDDEN",
  availableToday:    boolean,
  licenseKey:        string | null,
  _syncedAt:         Timestamp,
  _sourceId:         string,             // saas_doctors doc ID
}

Created via buildPublicDoctor() transform.

---

## Collection: saas_licenses

Document ID: License key string (e.g. "LIC-2026-001")

{
  licenseKey:      string,
  category:        "doctor" | "tenant",
  doctorName:      { en: string, ar: string },
  phone:           string,
  expiryDate:      string,           // "YYYY-MM-DD"
  status:          "ACTIVE" | "INACTIVE" | "EXPIRED",
  expired:         boolean,
  onlineBooking:   boolean,
  deviceId:        string | null,    // MAC address when bound
  createdAt:       Timestamp,
}

Queries: getAllLicenses() ordered by createdAt desc

---

## Collection: saas_settings

Document ID: "config" (single document)

{
  appName:               { en: string, ar: string },
  supportEmail:          string,
  supportPhone:          string,
  defaultLicenseDays:    number,         // 365
  maxDevicesPerLicense:  number,         // 1
  allowSelfRegistration: boolean,
  enforceDeviceLock:     boolean,
  autoExpireCheck:       boolean,
  maintenanceMode:       boolean,
  graceperiodDays:       number,         // 7
  webhookUrl:            string,
  smtpHost:              string,
  smtpPort:              string,         // "587"
  smtpUser:              string,
  smtpPass:              string,
  adminUids:             string[],       // UIDs of admin users
  updatedAt:             Timestamp,
}

Read: getDoc(saas_settings/config)
Write: setDoc(saas_settings/config) (full overwrite)

---

## Collection: app_versions

Document ID: App ID ("dr" | "sec" | "server")

{
  appId:         "dr" | "sec" | "server",
  version:       string,               // "2.5.0"
  buildNumber:   number,
  downloadUrl:   string,
  msiUrl:        string,
  releaseNotes:  string,               // markdown
  releaseDate:   string,               // "YYYY-MM-DD"
  minVersion:    string,
  forceUpdate:   boolean,
  status:        "published" | "draft" | "unpublished",
  fileSize:      number,               // bytes
  checksum:      string,               // SHA-256
  updatedAt:     Timestamp,
}

### Subcollection: app_versions/{appId}/releases/{versionId}

Same fields as parent document. Document ID = version string.

Queries:
  getReleaseHistory(appId, limit) -> ordered by createdAt desc

---

## Collection: clinic_servers

Document ID: MAC address string

{
  macAddress:    string,
  licenseKey:    string,
  tunnelUrl:     string,
  localIp:       string,
  port:          string,
  status:        "ONLINE" | "OFFLINE",
  lastSeen:      Timestamp,
  version:       string,
  registeredAt:  Timestamp,
}

Queries: getClinicServers() ordered by lastSeen desc
         getServerByLicense(licenseKey) filtered by licenseKey + status ONLINE

---

## Collection: comm_patients

Document ID: Phone number string

{
  phone:         string,
  // Additional patient fields
  synced:        boolean,
  lastUpdated:   Timestamp,
}

---

## Collection: comm_appointments

Document ID: Auto-generated

{
  // Appointment fields
  status:        "SCHEDULED",
  synced:        boolean,
  createdAt:     Timestamp,
  updatedAt:     Timestamp,
}

Queries:
  getAppointmentsByPatient(phone, tenantId) -> filtered
  getUnsyncedAppointments() -> paginated for sync

---

## Collection: sync_queue

Document ID: Auto-generated

{
  licenseKey:    string,
  tenantId:      string,
  appointmentId: string,
  patientPhone:  string,
  doctorId:      string,
  status:        "PENDING" | "FAILED",
  retryCount:    number,
  createdAt:     Timestamp,
  nextRetry:     Timestamp,
}

Queries:
  getPendingSyncItems(licenseKey) -> status PENDING, paginated

---

## Collection: comm_doctor_users

Document ID: Email string

{
  doctorId:      string,            // saas_doctors doc ID
  email:         string,
  firebaseUid:   string,            // Firebase Auth UID
  firstLogin:    boolean,
  createdAt:     Timestamp,
}

---

## Collection: saas_otp_requests

Document ID: Email string (temporary, auto-deleted)

{
  otpHash:       string,            // SHA-256 hex
  expiry:        string,            // ISO date string (+10 min)
  requestedAt:   string,            // ISO date string
  attempts:      number,            // max 5
}

TTL: Automatically deleted after OTP verification or expiry.

---

## Collection: admins

Document ID: Firebase Auth UID

{
  email:         string,
  fullName:      string,
  createdAt:     string,            // ISO date string
  role:          "admin",
  uid:           string,
}

## Firestore Security Rules (Summary)

saas_* collections:
  allow read, write: if request.auth.token.admin == true

comm_doctors, comm_tenants:
  read: if true (public)
  write: if request.auth.token.admin == true

comm_doctor_users:
  read: if request.auth.token.admin == true ||
        resource.data.email == request.auth.token.email
  write: if request.auth.token.admin == true

admins:
  read: if request.auth.token.admin == true
  write: if request.auth.token.admin == true

saas_otp_requests:
  read, write, delete: if true (needed for unauthenticated OTP flow)
