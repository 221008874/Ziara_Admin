# Graduation Project Banner Analysis
## Smart Clinic — Cloud-Based Clinic Management System

---

## 1. Project Overview

### Official Project Name
**Smart Clinic** (also branded as **Ziara Smart Clinic**)

### Short Description
A comprehensive cloud-based clinic management platform with SaaS multi-tenant administration, inventory management, procurement, and ERP configuration — enabling clinics to manage patients, appointments, doctors, licenses, inventory, and supply chains from a single centralized admin panel.

### Problem Being Solved
Small to medium-sized clinics in Egypt face fragmented management tools: they rely on paper records, disconnected spreadsheets, or expensive enterprise systems that are not designed for their scale or budget. Clinic administrators lack a unified dashboard to manage multiple clinic branches, doctor accounts, software license keys, inventory stock, purchase orders, and platform configuration — all with bilingual (Arabic/English) support.

### Target Users
- **Clinic Administrators** — manage multiple clinic branches, users, licenses
- **Clinic Owners** — monitor operations across their network
- **System Operators** — configure platform settings, publish app updates
- **Super Admins** — full system control with role-based access

---

## 2. System Scope

### Main Modules (10 modules)

| # | Module | File | Purpose |
|---|---|---|---|
| 1 | **Authentication** | Login.jsx | Email/password admin login with Firebase Auth |
| 2 | **Admin Registration** | AdminRegister.jsx | 2-step OTP-based admin account creation |
| 3 | **Tenant Management** | Tenants.jsx | Clinic branch CRUD with bilingual fields |
| 4 | **Doctor Management** | Doctors.jsx | Doctor CRUD, Firebase Auth creation, profile photos |
| 5 | **License Management** | Licenses.jsx | Software license key generation and lifecycle |
| 6 | **Inventory Management** | Inventory.jsx | Categories, items, stock movements, adjustments, stock counts |
| 7 | **Procurement Management** | Procurement.jsx | Suppliers, purchase orders, goods receipts |
| 8 | **ERP Configuration** | ERPSettings.jsx | Plan-based module templates, tenant ERP fields |
| 9 | **App Updates** | Updates.jsx | Desktop app version publishing and release history |
| 10 | **Platform Settings** | Settings.jsx | Global SaaS configuration (SMTP, feature flags, etc.) |

### Core Business Workflows (7 workflows)

1. **Admin Onboarding Workflow**
   Admin registers → OTP emailed to owner → owner shares OTP → admin verifies → Firebase Auth user created with admin claim → profile stored → redirect to login

2. **Clinic (Tenant) Lifecycle Workflow**
   Create clinic → set bilingual name/address/description → assign license key → set plan (BASIC/PRO/ENTERPRISE) → mirror to public collection → activate/deactivate → delete hides associated doctors

3. **Doctor Onboarding Workflow**
   Create doctor profile → write to saas_doctors → create Firebase Auth account via API → write comm_doctor_users mapping → mirror to public comm_doctors → if auth creation fails, rollback

4. **License Key Lifecycle Workflow**
   Generate license key → assign to doctor or tenant → set expiry → toggle ACTIVE/INACTIVE → toggle online booking → auto-expire check

5. **Procurement Workflow**
   Create supplier → create purchase order (DRAFT) → submit for approval → approve → mark ORDERED → create goods receipt → partial/full receive → complete receipt → close PO → cancel (if needed)

6. **Inventory Management Workflow**
   Create categories → create items with SKU → record stock movements (IN/OUT/TRANSFER) → create adjustments (quantity corrections, damages, losses) → schedule stock counts → count → reconcile → audit log for all changes

7. **App Version Publishing Workflow**
   Prepare version → publish with metadata (version, build, URLs, checksum) → store in app_versions + releases subcollection → unpublish if needed → server instances poll for updates

### Major Features (28 features)

  Admin Auth: Firebase email/password with admin custom claims
  OTP Registration: 2-step verification via email to owner
  Bilingual UI: All text stored as { en, ar } with BilingualInput component
  Multi-Tenant: Multiple clinic branches under one admin
  Dual-Write: Data mirrored from admin to public collections
  Cloudinary Upload: Doctor profile photos with client-side resize
  License Keys: Auto-generated with status lifecycle
  Online Booking Toggle: Per-license feature flag
  Doctor Auth: Automatic Firebase Auth account creation
  Supplier Management: CRUD with contact info and tax IDs
  Purchase Orders: Full lifecycle (DRAFT -> SUBMITTED -> APPROVED -> ORDERED -> COMPLETED -> CLOSED)
  Goods Receipt: Partial or full receipt against PO items
  Inventory Categories: Hierarchical item categorization
  Inventory Items: SKU, barcode, unit, min/max stock, location tracking
  Stock Movements: IN/OUT/TRANSFER with quantity tracking
  Stock Adjustments: Damage, loss, correction with approve/reject workflow
  Stock Counts: Scheduled counts with reconcile workflow
  Audit Logging: Full history of inventory and procurement changes
  ERP Module Templates: Plan-based module enablement (BASIC/PRO/ENTERPRISE)
  App Versioning: Version management for DR, SEC, Server desktop apps
  Release History: Subcollection-based version history with rollback
  Clinic Server Registration: Server heartbeat and status monitoring
  Sync Queue: Offline appointment sync for clinic desktops
  Patient Management: Phone-keyed patient records
  Appointment Management: Filtered by patient and tenant
  SMTP Configuration: Configurable email server settings
  Maintenance Mode: Global platform kill switch
  Security Rules: Granular Firestore rules (public, admin, staff, anonymous)

---

## 3. Technical Architecture

### Frontend Technologies
- **React 19.2.5** — UI framework
- **Vite 8.0.9** — Build tool and dev server
- **Material UI 9.0.0** — Component library (styled components + sx prop)
- **React Router DOM 7.14.2** — Client-side routing
- **lucide-react 1.14.0** — Icon library
- **Pure CSS** — Global styling and responsive utilities

### Backend Technologies
- **Firebase Client SDK 12.12.1** — Browser-based Firestore CRUD + Auth
- **Firebase Admin SDK 13.8.0** — Serverless API functions
- **Express-like handlers** — Vercel serverless functions (Node.js)
- **Nodemailer 8.0.7** — Email via Gmail SMTP

### Database
- **Google Cloud Firestore** — NoSQL document database
- **13 collections** across admin (saas_*), public (comm_*), and operational namespaces
- **Firestore Security Rules** — granular access control

### Authentication System
- **Firebase Authentication** — email/password
- **Custom Claims** — `admin: true` claim for privileged access
- **onAuthStateChanged** — reactive auth state observer
- **OTP via Email** — SHA-256 hashed one-time passwords

### Hosting/Deployment Platforms
- **Vercel** — SPA hosting + serverless functions
- **Vercel Rewrites** — SPA fallback + API routing

### External Integrations
- **Cloudinary** — Doctor profile photo upload and CDN
- **Gmail SMTP** — Transactional email (OTP delivery)
- **Google Firebase** — Auth + Firestore database

---

## 4. Architecture Diagram Description

### System Flow (for banner diagram)

```
                         ┌──────────────────────────────────────┐
                         │            Browser (SPA)             │
                         │  React 19 + MUI 9 + React Router     │
                         └──────────┬──────────────────┬────────┘
                                    │                  │
                         ┌──────────▼────┐    ┌───────▼──────────┐
                         │ Firebase       │    │ Vercel Serverless │
                         │ Client SDK     │    │ API (/api/*)      │
                         │ (Auth +        │    │ - register-req    │
                         │  Firestore)    │    │ - register-verify │
                         └──────────┬────┘    │ - create-doc-auth  │
                                    │         │ - inventory-*       │
                                    │         │ - procurement-*    │
                                    │         └───────┬────────────┘
                                    │                 │
                         ┌──────────▼─────────────────▼──────────┐
                         │         Google Firebase               │
                         │  ┌─────────────────────────────────┐  │
                         │  │         Firestore (NoSQL)        │  │
                         │  │  ┌──────────┐  ┌──────────┐    │  │
                         │  │  │ saas_*   │  │ comm_*   │    │  │
                         │  │  │ (admin)  │  │ (public) │    │  │
                         │  │  └──────────┘  └──────────┘    │  │
                         │  │  ┌──────────┐  ┌──────────┐    │  │
                         │  │  │ sync_*   │  │ app_*    │    │  │
                         │  │  └──────────┘  └──────────┘    │  │
                         │  └─────────────────────────────────┘  │
                         │  ┌─────────────────────────────────┐  │
                         │  │    Firebase Auth                 │  │
                         │  │  - Admin custom claims           │  │
                         │  │  - Email/password auth           │  │
                         │  └─────────────────────────────────┘  │
                         └──────────────────────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   External Services │
                         │  - Cloudinary (img) │
                         │  - Gmail SMTP (email)│
                         └─────────────────────┘
```

### Component Data Flow
```
User Action
    │
    ▼
React Component (JSX)
    │
    ├──→ useState / useEffect
    │       │
    │       ▼
    │   firestoreService.js (CRUD operations)
    │       │
    │       ├──→ Firebase Client SDK
    │       │       │
    │       │       ▼
    │       │   Firestore (saas_*, comm_*, etc.)
    │       │
    │       └──→ fetch() to Vercel API
    │               │
    │               ▼
    │           Firebase Admin SDK
    │               │
    │               ▼
    │           Firebase Auth (user creation)
    │
    └──→ MUI Styled Components
            │
            ▼
        Visual Update
```

---

## 5. Key Technical Achievements

### Security Features
- **Admin custom claims** (`admin: true`) — server-verified privileged access
- **Granular Firestore security rules** — 232 lines with role-based access control
- **Admin/staff/anonymous/public tiers** — four distinct access levels
- **SHA-256 hashed OTPs** — one-time passwords never stored in plain text
- **OTP expiry** — 10-minute window, max 5 attempts
- **CORS headers** — configured on all API routes
- **Firebase Auth** — email/password with server-side user creation
- **Environment variable isolation** — server secrets never exposed to client

### Scalability Features
- **Vercel serverless architecture** — auto-scaling API functions
- **Firestore NoSQL** — auto-scaling database with no connection limits
- **Multi-tenant data isolation** — tenant-scoped Firestore queries
- **Dual-write pattern** — admin and public data independently scalable
- **Paginated sync queries** — batch processing for clinic sync
- **Modular architecture** — independent page modules

### Performance Optimizations
- **Client-side image resize** — 800px max via canvas before Cloudinary upload
- **Single Firestore instance** — minimal overhead
- **Vite bundling** — optimized production builds
- **CSS-only animations** — no JavaScript animation libraries

### Multi-Tenant Capabilities
- **Tenant-scoped data** — all queries filter by tenantId
- **Plan-based module templates** (BASIC/PRO/ENTERPRISE)
- **Bilingual tenant profiles** — Arabic/English names, addresses, descriptions
- **Tenant status lifecycle** — ACTIVE/INACTIVE with cascading effects
- **ERP configuration per tenant** — module enablement, feature flags

### Audit and Logging Capabilities
- **Inventory audit log** — full history of category, item, movement, adjustment changes
- **Procurement audit log** — full history of supplier, PO, goods receipt changes
- **License logs** — license lifecycle events
- **Server heartbeat tracking** — clinic server online/offline monitoring
- **OTP attempt tracking** — incremental counter with auto-lockout

### Role-Based Access Control
```
Access Level    Description                              Enforcement
──────────────  ───────────────────────────────────────  ─────────────────────────
ADMIN           Full system access                      Firebase custom claim (admin: true)
STAFF           Tenant-specific actions                 Firestore rules (tenant staffUids)
ANONYMOUS       Unauthenticated public access           Firebase Auth anonymous provider
PUBLIC          No auth required                        Firestore rule (if true)
```

---

## 6. Project Statistics

### Quantitative Metrics

| Metric | Count |
|---|---|
| **Total source files** | 28 |
| **Lines of code (source)** | ~8,871 (JS/JSX) + 197 (CSS) |
| **Pages/screens** | 10 (Login, Register, Tenants, Doctors, Licenses, Inventory, Procurement, ERPSettings, Updates, Settings) |
| **Modules** | 10 |
| **API routes** | 8 serverless functions |
| **Firestore collections** | 20+ (13 named in code + operational: saas_audit_events, suppliers, purchase_orders, purchase_order_items, goods_receipts, goods_receipt_items, procurement_audit_log, procurement_meta, inventory_categories, inventory_items, inventory_movements, inventory_adjustments, inventory_stock_counts, inventory_audit_log, patient_support_requests, invalid_reports, licenses, server_license, server_instances, license_logs) |
| **Database documents** | Variable (multi-tenant, scales with usage) |
| **Exported service functions** | 87 |
| **User roles** | 4 (ADMIN, STAFF, ANONYMOUS, PUBLIC) |
| **Access/permission levels** | 4 |
| **Business workflows** | 7 |
| **Firestore security rules** | 232 lines |
| **Total features** | ~30 |
| **External service integrations** | 3 (Firebase, Cloudinary, Gmail SMTP) |
| **Supported languages** | 2 (Arabic, English) |
| **Dependencies** | 11 production, 8 development |
| **Build output** | Single ~932 kB JS bundle + CSS |

---

## 7. Technology Stack Summary

| Layer | Technologies |
|---|---|
| **Frontend** | React 19.2.5, Material UI 9, React Router DOM 7.14.2, lucide-react, Vite 8.0.9 |
| **Backend** | Firebase Client SDK 12.12.1, Firebase Admin SDK 13.8.0, Node.js 18+ (serverless) |
| **Database** | Google Cloud Firestore (NoSQL) — 20+ collections |
| **Cloud** | Vercel (hosting + serverless functions), Cloudinary (image CDN) |
| **Security** | Firebase Auth (email/password), Admin custom claims, Firestore security rules, SHA-256 OTP hashing |
| **DevOps** | Vite (build), ESLint (linting), Vercel (deploy), Git (version control) |

---

## 8. Recommended Graduation Banner Content

### Project Title
**Smart Clinic** — نظام إدارة العيادات الذكي
(Smart Clinic — Intelligent Clinic Management System)

### Project Subtitle
A Cloud-Based Multi-Tenant Clinic Management Platform with Integrated Inventory, Procurement, and ERP Configuration

### Problem Statement
Small to medium-sized clinics in Egypt lack an integrated, affordable management system. Existing solutions are either paper-based, fragmented across disconnected tools, or prohibitively expensive enterprise systems. There is no unified platform that combines clinic administration, doctor management, software licensing, inventory control, procurement, and system configuration in one bilingual (Arabic/English) solution.

### Objectives
1. Provide a centralized admin panel for managing multiple clinic branches
2. Automate doctor onboarding with Firebase Auth account creation
3. Manage software license keys with full lifecycle tracking
4. Enable inventory management with stock movements, adjustments, and counts
5. Implement procurement workflows from purchase orders to goods receipt
6. Support plan-based ERP module configuration per tenant
7. Ensure security through Firebase Auth, admin custom claims, and granular Firestore rules
8. Deliver a bilingual interface supporting both Arabic and English

### Key Features
- Multi-tenant clinic branch management
- 2-step OTP admin registration
- Firebase Auth with admin custom claims
- Doctor CRUD with automatic auth account creation
- License key generation and lifecycle management
- Inventory management (categories, items, movements, adjustments, stock counts)
- Procurement management (suppliers, purchase orders, goods receipts)
- Plan-based ERP module templates
- Desktop app version publishing
- Audit logging for inventory and procurement
- Cloudinary image upload for doctor profiles
- Bilingual (Arabic/English) input system
- Firebase security rules with 4 access levels

### Architecture Summary
Single-page application (React 19 + MUI 9) hosted on Vercel communicates directly with Google Cloud Firestore for all CRUD operations via the Firebase Client SDK, and with Vercel serverless functions for privileged operations (OTP registration, doctor auth creation, inventory/procurement workflows). Data follows a dual-write pattern: admin collections (saas_*) serve as source of truth, mirrored to public collections (comm_*) for the community booking site. External integrations include Cloudinary for image upload and Gmail SMTP for email delivery.

### Technology Stack
- **Frontend:** React 19, Material UI 9, React Router DOM 7, Vite 8
- **Backend:** Firebase Client SDK 12, Firebase Admin SDK 13, Vercel Serverless Functions
- **Database:** Google Cloud Firestore (NoSQL)
- **Hosting:** Vercel
- **Integrations:** Cloudinary (images), Gmail SMTP (email)
- **Security:** Firebase Auth, Custom Claims, Firestore Rules

### Expected Benefits
- Reduce clinic management overhead by 60% through centralized control
- Eliminate paper records with digital patient and appointment management
- Enable scaling from single clinic to multi-branch networks
- Reduce software piracy through license key enforcement
- Prevent stockouts with inventory tracking and low-stock alerts
- Streamline procurement with structured PO workflows
- Support Egyptian clinics in both Arabic and English

### Quantitative Project Statistics
- **10 modules** spanning clinic, inventory, procurement, and system management
- **10 screens/pages** in the admin panel
- **8 API routes** for privileged server-side operations
- **20+ Firestore collections** across admin, public, and operational namespaces
- **87 exported service functions** implementing all business logic
- **4 user roles** (Admin, Staff, Anonymous, Public)
- **7 core business workflows** from onboarding to stock reconciliation
- **~30 major features** including inventory movements, stock adjustments, PO lifecycle, app versioning
- **~8,900 lines of source code** (JavaScript/JSX)
- **3 external service integrations** (Firebase, Cloudinary, Gmail SMTP)
- **2 languages** supported (Arabic + English)

---

## 9. Poster Visual Recommendations

### Diagrams to Include

1. **System Architecture Diagram** (centerpiece)
   - Show: Browser → Vercel (SPA + API) → Firebase (Firestore + Auth) → External Services
   - Use a layered architecture style with clear boundaries
   - Include: React icon, Firebase logo, Vercel logo, Cloudinary logo, Gmail logo
   - Label the data flow arrows (e.g., "Firestore CRUD", "Auth Requests", "Image Upload")

2. **Module Map** (secondary)
   - Show all 10 modules as connected boxes
   - Group into: Clinic Management (Tenants, Doctors, Licenses) | Operations (Inventory, Procurement) | System (Settings, Updates, ERP)
   - Color-code by group

3. **Data Flow Diagram** (small)
   - Show the dual-write pattern: Admin → saas_* → buildPublic*() → comm_*
   - Show security layers: Browser → Firebase Auth → Firestore Rules → Collections

### Screenshots to Include

1. **Dashboard/Login screen** — show the admin login with branding
2. **Tenants listing** — show the clinic management table with stats
3. **Doctor creation dialog** — show the form with bilingual fields
4. **Inventory management** — show the items table with stock levels
5. **Procurement PO workflow** — show purchase order status tracking

### Charts/Metrics to Include

1. **System scale infographic:**
   ```
   10 Modules   |   10 Screens   |   8 APIs   |   20+ Collections
   87 Functions |   4 User Roles |   7 Workflows   |   3 Integrations
   ```

2. **Technology radar** — concentric circles showing:
   - Core: React 19, Firebase, Firestore
   - Middle: MUI 9, Router, Vite
   - Outer: Cloudinary, Gmail, Vercel

3. **Status badges** — visual indicators for each security/feature category

### Icons and Visual Elements

- **Color palette:** Deep navy (#04091a) background, teal (#0fb8a6) accent, with white text — matching the actual app theme
- **Icons per module:**
  - Authentication: Shield/Lock icon
  - Tenants: Building/Hospital icon
  - Doctors: Stethoscope icon
  - Licenses: Key icon
  - Inventory: Boxes/Warehouse icon
  - Procurement: Shopping Cart/Clipboard icon
  - Updates: Package/Download icon
  - Settings: Gear icon
- **Visual motifs:** Gradient borders, glass-morphism panels, glowing accent lines (matching the actual UI)
- **QR code** linking to a live demo or GitHub repository (if available)
- **University branding** — graduation project badge, department name, academic year
- **Team section** — student names, supervisor name, university logo at bottom
