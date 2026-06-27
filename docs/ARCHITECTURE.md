# Architecture Overview

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19.2.5 |
| Bundler | Vite | 8.0.9 |
| Routing | react-router-dom | 7.14.2 |
| UI Library | @mui/material (Material UI) | 9.0.0 |
| Icons | lucide-react | 1.14.0 |
| Backend (BaaS) | Firebase (Auth + Firestore) | 12.12.1 |
| Serverless API | Firebase Admin SDK (Vercel) | 13.8.0 |
| Email | Nodemailer (Gmail SMTP) | 8.0.7 |
| Image Upload | Cloudinary | Client-side |
| Language | JavaScript (no TypeScript) | — |

## Deployment Architecture

Browser -> Vercel (CDN) -> SPA (dist/) + API Routes (/api/*) -> Firebase Client/Admin SDK -> Google Firebase

- **SPA** served by Vercel — all routes fall back to index.html
- **API routes** (/api/*) are Vercel serverless functions
- **Firebase Client SDK** runs in browser for Firestore CRUD + Auth
- **Firebase Admin SDK** runs server-side for privileged operations

## Project Structure

clinic-admin/
  api/admin/
    register-request.js        Step 1: OTP request
    register-verify.js         Step 2: OTP verify + create admin
    create-doctor-auth.js      Create doctor Firebase Auth account
  src/
    assets/                    logo.png, etc.
    components/
      Sidebar.jsx              Navigation sidebar + Hamburger
    lib/
      cloudinary.js            Cloudinary image upload
      collections.js           [UNUSED] Collection name constants
      debug.js                 Colored console logging
      firestore.js             [UNUSED] Legacy Firestore helpers
      i18n.jsx                 Bilingual (en/ar) helpers + BilingualInput
    pages/
      components/
        ProtectedRoute.jsx     [UNUSED] localStorage-based guard
        shared/PageShells.jsx  Shared layout components
      AdminRegister.jsx        2-step OTP registration
      Doctors.jsx              Doctor CRUD (1163 lines)
      Licenses.jsx             License key CRUD
      Login.jsx                Email/password login
      Settings.jsx             Global platform config
      Tenants.jsx              Clinic/tenant CRUD
      Updates.jsx              App version management
    services/
      firestoreService.js      ALL Firestore operations (752 lines)
    App.css                    [UNUSED] Legacy template styles
    App.jsx                    Root: router, RequireAuth, SidebarCtx
    firebase.js                Firebase Client SDK init
  api/                         Vercel serverless routes
  index.html
  vite.config.js
  vercel.json
  firebase.json
  firestore.rules
  eslint.config.js
  package.json

## Design Decisions

### 1. Dual-Write Pattern (saas_* + comm_*)
Writes data to two Firestore collection sets:
- **saas_*** — Admin-only (protected by admin claim)
- **comm_*** — Public-facing for community booking site
Doctors/Tenants mirrored via buildPublic*() transform.

### 2. Client-Side Firestore CRUD
All CRUD via Firebase Client SDK from browser. Security rules enforce admin-only.
Only 3 operations use serverless APIs (OTP registration, doctor auth creation).

### 3. No Global State Library
Only useState + useEffect. Single context (SidebarCtx) for sidebar toggle.

### 4. MUI Styled Components
Each page defines styled() components. Some duplication across pages.

### 5. Bilingual (Arabic/English)
Text stored as { en: string, ar: string }. BilingualInput renders side-by-side.

## Key Constraints
- No TypeScript
- Single Firestore region
- ~932 kB bundle (single chunk, no code splitting)
- Vercel 10s serverless timeout
