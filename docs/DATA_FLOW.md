# Data Flow & API Integration

## Overview

The app uses two data access patterns:

1. **Direct Firestore Client SDK** (browser -> Firebase) — for all CRUD operations
2. **Vercel Serverless API** (browser -> API -> Firebase Admin SDK) — for privileged operations

---

## Firestore Collections (13 total)

Admin Collections (saas_*):
  saas_tenants     Clinics/tenants (admin CRUD source of truth)
  saas_doctors     Doctors (admin CRUD source of truth)
  saas_licenses    License keys
  saas_settings    Global platform config (single doc: "config")
  saas_otp_requests  OTP temp storage (email keyed, auto-deleted)

Public Collections (comm_*):
  comm_tenants      Public mirror of tenants (subset of fields)
  comm_doctors      Public mirror of doctors (subset of fields)
  comm_patients     Patient records (phone keyed)
  comm_appointments Appointment records
  comm_doctor_users Doctor Auth account mapping

Operational Collections:
  sync_queue        Pending sync items for clinic servers
  clinic_servers    Registered clinic server instances
  app_versions      App version docs + releases subcollection
  admins            Admin user profiles

---

## Dual-Write Pattern: Tenants & Doctors

Both Tenants and Doctors follow this pattern:

### Create
  saas_* document created (source of truth)
    -> buildPublicTenant() / buildPublicDoctor() transforms fields
    -> Write to comm_* collection (public subset)

### Update
  saas_* document updated
    -> Syncable fields flow to comm_*
    -> Status changes update active + visibility fields

### Delete
  saas_* document deleted
    -> comm_* document deleted
    -> Doctor delete also hides associated comm_doctors records

### Public Transform (saas -> comm)

Tenant (buildPublicTenant):
  Fields passed through: id, name, city, address, logoUrl, description
  Fields added: active (true), visibility (PUBLIC), _syncedAt, _sourceId
  Fields dropped: contactEmail, contactPhone, plan, licenseKey, expiryDate

Doctor (buildPublicDoctor):
  Fields passed through: name, specialty, bio, photoUrl, tenantId,
    clinicName, city, address, education, languages, yearsOfExperience
  Fields added: active (true), visibility (PUBLIC), _syncedAt, _sourceId
  Fields dropped: email, phone, password, licenseKey, status
  Languages transformed from string[] to bilingual array

---

## API Routes

### 1. POST /api/admin/register-request

Step 1 of admin registration. Generates OTP and emails the owner.

Request Body:
  { email: string, password: string }

Server Logic:
  1. Check Firebase Auth if email already exists with admin claim
  2. Generate 6-digit OTP
  3. Hash OTP with SHA-256
  4. Store { otpHash, expiry (+10 min), attempts: 0 } in saas_otp_requests/{email}
  5. Send email via Nodemailer (Gmail SMTP) to OWNER_EMAIL
     HTML template includes OTP, requester email, password length
  6. Return { success: true }

Errors:
  400: Missing/Invalid email, Already registered as admin
  500: Firebase init failure, Send mail failure

Environment Required:
  FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
  GMAIL_USER, GMAIL_APP_PASSWORD
  OWNER_EMAIL

### 2. POST /api/admin/register-verify

Step 2 of admin registration. Verifies OTP and creates admin.

Request Body:
  { email: string, otp: string, fullName: string, password: string }

Server Logic:
  1. Read saas_otp_requests/{email} doc
  2. Check expiry (10 min window)
  3. Check attempts (< 5, increment on failure)
  4. Hash input OTP and compare with stored hash
  5. Create Firebase Auth user with email, password, displayName
  6. Set custom claim: admin: true
  7. Add UID to saas_settings/config/adminUids array
  8. Create admins/{uid} doc with profile
  9. Delete OTP document
  10. Return { success: true, uid }

Errors:
  400: Missing fields, Expired OTP, Too many attempts, Invalid OTP,
       Email already exists, Weak password
  500: Firebase error

### 3. POST /api/admin/create-doctor-auth

Creates Firebase Auth account for a doctor.

Request Body:
  { email: string, password: string, uid: string }

uid is the saas_doctors document ID (generated client-side).

Server Logic:
  1. Validate email format + password >= 8 chars
  2. Create Firebase Auth user with email + password
  3. Return { success: true, firebaseUid }

Errors:
  400: Missing/Invalid fields, Email already exists
  500: Firebase error

Called From: firestoreService.createDoctor() (client-side)

---

## Sync Queue Pattern

Used for clinic servers to pull pending appointment changes.

Collections:
  sync_queue/{autoId}
    licenseKey: string
    tenantId: string
    appointmentId: string
    patientPhone: string
    doctorId: string
    status: "PENDING" | "FAILED"
    retryCount: number
    createdAt: Timestamp
    nextRetry: Timestamp

Functions:
  queueSyncAppointment()     Push an appointment change to queue
  getPendingSyncItems()      Pull pending items (paginated)
  markSyncComplete()         Delete queue item
  markSyncFailed()           Mark as FAILED with retry info

---

## Cloudinary Image Upload

File: src/lib/cloudinary.js

Flow:
  1. User selects image file via MUI input
  2. Load image into Image() element
  3. Draw onto canvas, resize to max 800px width/height
  4. Convert to blob (image/jpeg, 0.85 quality)
  5. Build FormData with: file, upload_preset (VITE_CLOUDINARY_UPLOAD_PRESET),
     folder ("doctors")
  6. POST to https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload
  7. Return secure_url

Used in: Doctors.jsx for doctor profile photo.

---

## Data Flow Diagram (Text)

Admin Registration:
  Browser                          Server (Vercel)                  Firebase/Gmail
  --------                         ---------------                  -------------
  1. POST /register-request  -->   2. Generate OTP
                                   3. Store hash in Firestore  -->  saas_otp_requests
                                   4. Send email via SMTP  ------>  OWNER_EMAIL
  5. User enters OTP
  6. POST /register-verify   -->   7. Verify hash
                                   8. Create Auth user      ---->   Firebase Auth (admin:true)
                                   9. Store admin profile   ---->   admins/{uid}
                                  10. Clean up OTP doc      ---->   Delete saas_otp_requests

Doctor Create:
  Browser                          Server (Vercel)                  Firebase
  --------                         ---------------                  --------
  1. Write saas_doctors doc  -->   (direct Firestore)         -->   saas_doctors
  2. POST /create-doctor-auth -->  3. Create Auth user        -->   Firebase Auth
  4. Write comm_doctor_users  -->  (direct Firestore)         -->   comm_doctor_users
  5. Mirror to comm_doctors   -->  (direct Firestore)         -->   comm_doctors
  (If step 3 fails: rollback by deleting saas_doctors doc)

Tenant/Doctor Read:
  Browser                          Firestore
  --------                         ---------
  1. Query saas_tenants       -->  ordered by createdAt desc
  2. Query saas_doctors       -->  ordered by createdAt desc
  (All reads are direct client-side Firestore queries)

App Version Publish:
  Browser                          Firestore
  --------                         ---------
  1. setDoc(app_versions/{id}) -->  version data
  2. addDoc(releases subcoll)  -->  history entry
  3. getDoc(app_versions/{id}) -->  fetch current status
