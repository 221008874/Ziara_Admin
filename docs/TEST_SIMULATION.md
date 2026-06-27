# Data Flow & Usage Simulation Report
## Smart Clinic Admin Panel — Comprehensive Test Analysis

---

## 1. Environment & Build Status

### Build Result: ✅ PASS
- 2,658 modules transformed
- Build time: 1.17s
- Bundle: 1,082 kB JS (310 kB gzipped)
- Chunk size warning: exceeds 500 kB — no code splitting configured

### Environment Configuration

| Item | Detail |
|---|---|
| Vercel env vars | ✅ All `VITE_FIREBASE_*` variables are set in the Vercel project dashboard. No local `.env` file needed for production. |
| .env.example prefix mismatch | 🟡 WARNING: `.env.example` uses `NEXT_PUBLIC_*` (Next.js) but `src/firebase.js` expects `VITE_*` (Vite). If someone copies `.env.example` → `.env.local` for local dev, variables won't be picked up. Rename prefix to `VITE_*` in the example file. |
| .env.example exposes real project IDs | 🟡 WARNING: Contains `smartclinicadmin` project ID and sender ID. Not a security risk for Firebase (API key is public by design), but should use placeholder values in templates. |
| No test framework | 🟡 WARNING: Zero test files — no Jest, Vitest, Cypress, Playwright. No test runner in package.json. |
| No CI/CD pipeline | 🟡 WARNING: No GitHub Actions or CI config. Only Vercel deployment. |

---

## 2. Firestore Security Rules Analysis (firestore.rules — 232 lines)

### Rules Coverage by Collection

| Collection Group | Read | Create | Update | Delete | Issues |
|---|---|---|---|---|---|
| saas_tenants | ✅ admin only | ✅ admin only | ✅ admin only | ✅ admin only | None |
| saas_doctors | ✅ admin only | ✅ admin only | ✅ admin only | ✅ admin only | None |
| saas_licenses | ✅ admin only | ✅ admin only | ✅ admin only | ✅ admin only | None |
| saas_settings | ✅ admin only | ✅ admin only | ✅ admin only | ✅ admin only | None |
| saas_audit_events | ✅ admin only | ✅ admin only | ✅ admin only | ✅ admin only | None |
| comm_doctors | ✅ public | ✅ admin/staff | ✅ admin/staff | ✅ admin only | None |
| comm_tenants | ✅ public | ✅ admin only | ✅ admin/staff | ✅ admin only | None |
| comm_patients | ✅ auth+multi | ✅ auth+phone | ✅ auth+multi | ✅ admin only | ⚠️ See below |
| comm_appointments | ✅ auth+multi | ✅ auth+validPhone | ✅ auth+multi | ✅ admin only | None |
| comm_doctor_users | ✅ email match | ✅ admin only | ✅ admin only | ❌ denied | None |
| patient_support_requests | ✅ admin/staff | ✅ any auth | ✅ admin only | ✅ admin only | None |
| inventory_* | ✅ admin only | ✅ admin only | ⚠️ varies | ⚠️ mostly denied | See below |
| procurement_* | ✅ admin only | ✅ admin only | ⚠️ varies | ⚠️ mostly denied | See below |
| app_versions/releases | ✅ admin only | ✅ admin only | ✅ admin only | ✅ admin only | None |
| sync_queue | ✅ admin only | ✅ admin only | ✅ admin only | ✅ admin only | None |
| licenses, servers, etc. | ✅ admin only | ✅ admin only | ✅ admin only | ✅ admin only | None |

### ⚠️ Security Rules Issues Found

**Issue #1 — comm_patients: CREATE rule allows anonymous users without phone auth**
```
allow create: if (request.resource.data.phone == phone && isValidPhone(phone)) || isAnyAdmin() || isAnonymous();
```
- An anonymous user can create a patient record with any phone number that matches the document ID pattern `^01[0125][0-9]{8}$`. The rule checks `phone == phone` (document ID == request.data.phone) but does NOT verify `request.auth.token.phone_number`. An anonymous user could create unlimited patient records by simply including a valid Egyptian phone number in the request data.
- **Risk:** Low (patient creation is a non-sensitive operation), but allows unauthenticated data insertion.

**Issue #2 — comm_doctor_users: READ allows email match but no admin fallback for support**
```
allow read: if request.auth != null && request.auth.token.email == email;
```
- Only the doctor whose email matches can read their own record. Admins cannot read this collection directly. If an admin needs to look up which doctor UID maps to which email, they can't.
- **Risk:** Low — admins can get this info from `saas_doctors`. But it means the `comm_doctor_users` admin lookup is unavailable.

**Issue #3 — saas_otp_requests: NO RULES DEFINED**
- The `saas_otp_requests` collection is used by the API routes for OTP storage but has no explicit rules. It falls through to the default deny rule `match /{document=**} { allow read, write: if false; }`.
- **This is correct** — OTP operations are done server-side via Firebase Admin SDK which bypasses security rules. The client SDK should NOT have direct access to OTP docs. ✅

**Issue #4 — inventory_movements: UPDATE and DELETE denied**
```
allow update, delete: if false;
```
- Once a movement is created, it cannot be modified or deleted. This is intentional (audit trail), but the client-side code may attempt to update movements — it will fail silently if the rules block it.
- **Risk:** Low — the server-side APIs handle movement creation. Client-side should only read movements.

**Issue #5 — goods_receipts: DELETE denied**
```
allow delete: if false;
```
- Goods receipts cannot be deleted once created. This is intentional, but if a receipt is created in error, there is no way to remove it — only cancel.

### Helper Function Analysis

| Helper | Purpose | Issue |
|---|---|---|
| isAnyAdmin() | Checks `admin == true` custom claim | ✅ Correct |
| isTenantStaff(tenantId) | Checks UID in tenant staffUids array | ⚠️ Requires saas_tenants doc to exist and have staffUids field. Will crash if doc missing or field undefined. |
| isAnonymous() | Checks sign-in provider | ✅ Correct |
| isValidPhone(phone) | Egyptian phone regex | ✅ `^01[0125][0-9]{8}$` correct for Egypt |

---

## 3. API Endpoint Analysis (8 serverless functions)

### Shared Pattern (all 8 APIs)
```
1. CORS OPTIONS handler
2. Method check (POST only)
3. Auth: Bearer token -> verifyIdToken() -> check decoded.admin
4. Validate request body parameters
5. Execute Firestore operations
6. Return JSON response
```

### API-by-API Analysis

#### POST /api/admin/register-request
| Aspect | Result |
|---|---|
| Input validation | ✅ Email regex validated, password length checked |
| OTP generation | ✅ 6-digit random, SHA-256 hashed |
| Storage | ✅ 10-min expiry, starts at 0 attempts |
| Edge cases | ✅ Duplicate email check (existing admin) |
| Error handling | ✅ Firebase error logged, 500 returned |
| **Issue** | ⚠️ `crypto.subtle.digest()` requires Secure Context (HTTPS). On localhost, Vite dev server may fail. |

#### POST /api/admin/register-verify
| Aspect | Result |
|---|---|
| Input validation | ✅ Email, OTP, fullName, password all validated |
| OTP verification | ✅ Hash comparison, expiry check, attempt limit (5) |
| Auth creation | ✅ Firebase user created with admin:true claim |
| AdminUids sync | ✅ Added to saas_settings/config document |
| Rollback | ⚠️ **Missing**: If adminUids update fails, user is created with admin claim but not in the adminUids list. The Firestore rules check `admin == true` claim, not adminUids, so the user would still work. But inconsistency exists. |
| Cleanup | ✅ OTP doc deleted on success |

#### POST /api/admin/create-doctor-auth
| Aspect | Result |
|---|---|
| Input validation | ✅ Email, password (>=8), uid all validated |
| Auth creation | ✅ Firebase Auth user created |
| Error handling | ✅ Email already exists, weak password handled |
| **Issue** | ⚠️ **No rollback if Auth creation succeeds but Firestore write fails.** The API only creates Auth user, doesn't write to saas_doctors. That happens client-side. If Auth succeeds but the subsequent client-side write fails, an orphan Auth user with no doctor profile exists. |

#### POST /api/admin/inventory-adjustment
| Aspect | Result |
|---|---|
| Auth verification | ✅ Bearer token + admin claim |
| Input validation | ✅ tenantId, itemId, reason (enum), actualQty (number) |
| Business logic | ✅ Reads current stock -> computes difference -> writes adjustment -> creates movement -> updates item stock -> audit log |
| Transaction safety | ✅ Uses `firestore.batch()` for atomic write |
| **Issue** | ⚠️ `difference = actualQty - expectedQty`. If `actualQty < expectedQty` (loss), difference is negative. The movement creates a negative quantity "ADJUSTMENT" which is correct. ✅ |

#### POST /api/admin/inventory-batch-create
| Aspect | Result |
|---|---|
| Input validation | ✅ SKU format, bilingual name, unit enum, categoryId |
| Duplicate prevention | ✅ Checks SKU uniqueness per tenant before creating |
| Batch processing | ✅ Uses `firestore.batch()` but limited to 500 operations across batch items |
| Partial success | ✅ Returns list of created items and errors for failed items |
| **Issue** | ⚠️ **Audit log writes happen per item OUTSIDE the batch** — each `firestore.collection('inventory_audit_log').add()` is a separate write that could fail independently. Also, batch is limited to 500 operations; with ~10 writes per item, this limits batch to ~50 items. |

#### POST /api/admin/inventory-stock-count
| Aspect | Result |
|---|---|
| Input validation | ✅ tenantId, countDate (>=1 char check — not strict date format), items array |
| Auto-reconciliation | ✅ Creates adjustments and movements for each discrepancy |
| Batch safety | ✅ Each adjustment uses individual batch (not one big batch) |
| **Issue** | ⚠️ countDate validation is weak — only checks truthiness (`if (!countDate)`). Does NOT validate YYYY-MM-DD format. |
| **Issue** | ⚠️ If an item in the count doesn't exist (`!itemSnap.exists`), it's silently skipped with no error reported to the user. |

#### POST /api/admin/procurement-approve
| Aspect | Result |
|---|---|
| State machine enforcement | ✅ Only allows APPROVED transition from SUBMITTED status |
| Error messages | ✅ Clear error with current status |
| Audit logging | ✅ Logs PO_APPROVED event |
| **Issue** | ⚠️ Input PO status validation is server-side, but the actual `purchase_orders` document is written to client-side. The client could set any status via `updateDoc()`. The Firestore rules only check `isAnyAdmin()`, not the PO status transition validity. **The state machine is NOT enforced server-side.** |

#### POST /api/admin/procurement-receive
| Aspect | Result |
|---|---|
| GR lifecycle | ✅ Only completes DRAFT receipts |
| Inventory integration | ✅ Updates item stock, calculates weighted average cost |
| PO status calculation | ✅ Correctly calculates RECEIVED vs PARTIALLY_RECEIVED vs ORDERED |
| Audit trail | ✅ Logs all movements and GR completion |
| **Issue** | ⚠️ If a batch write partially fails (e.g., inventory_items update succeeds but movement write fails), there is no rollback. The Firestore batch ensures either all writes in the batch succeed or none, so this is actually safe. ✅ |

---

## 4. Business Logic Issues Found

### 🔴 Issue #1 — Client-side PO status enforcement bypass
**File:** `src/services/firestoreService.js` (PO update functions)

The `getPOs()` function returns PO data from Firestore. The `updatePO()` function calls `updateDoc()` directly. There is NO client-side `validatePOTransition()` call before writing. The validation function exists in `procurementValidation.js` but is never called in `firestoreService.js`.

**Impact:** The UI could accidentally transition a PO to an invalid state. For example, going from DRAFT directly to RECEIVED (skipping SUBMITTED, APPROVED, ORDERED). The `procurement-approve.js` API does validate the SUBMITTED->APPROVED transition, but no other transitions are validated server-side.

### 🔴 Issue #2 — Doctor creation rollback gap
**File:** `src/services/firestoreService.js` (createDoctor, ~lines 302-522)

When creating a doctor:
1. saas_doctors doc created
2. POST to create-doctor-auth API
3. comm_doctor_users doc created
4. comm_doctors doc created

If step 2 (Auth creation) fails, the saas_doctors doc is deleted (rollback). But if step 3 or 4 fails AFTER Auth succeeds, there's **no rollback** — an orphan Auth user exists in Firebase Auth with no corresponding Firestore records.

### 🔴 Issue #3 — Tenant delete cascading hide is incomplete
**File:** `src/services/firestoreService.js:279-299`

`deleteTenant()` deletes from saas_tenants + comm_tenants, then hides comm_doctors for that tenant. But it does NOT:
- Delete doctors from saas_doctors
- Delete associated licenses
- Delete inventory/procurement data for that tenant

Tenant data becomes orphaned in saas_doctors, saas_licenses, inventory_*, and procurement_* collections.

### 🟡 Issue #4 — .env.example uses wrong prefix
The `.env.example` file uses `NEXT_PUBLIC_FIREBASE_*` (Next.js convention), but `src/firebase.js` uses `import.meta.env.VITE_FIREBASE_*` (Vite convention). Without renaming, the app will fail to connect to Firebase.

### 🟡 Issue #5 — No input sanitization on update operations
Several `update*` functions in firestoreService.js pass user-supplied data directly to `updateDoc()`. While Firestore SDK itself prevents NoSQL injection, there's no server-side validation for most field values (e.g., updating a doctor's specialization to an invalid value, or setting an impossible expiry date).

### 🟡 Issue #6 — Sync queue has no cleanup mechanism
The `sync_queue` collection writes are never cleaned up except by `markSyncComplete()` which deletes individual items. There is no TTL, no periodic cleanup, and no mechanism to handle stale FAILED items. If a clinic server goes offline permanently, its queue items remain forever.

---

## 5. Workflow Simulations

### Simulation #1: Admin Onboarding
```
Step 1: User navigates to /register
Step 2: Enters email + password
Step 3: POST /api/admin/register-request
          -> Server generates OTP, emails owner
Step 4: Owner receives OTP email, shares with admin
Step 5: Admin enters OTP + full name
Step 6: POST /api/admin/register-verify
          -> OTP validated -> Firebase Auth user created with admin:true
          -> UID added to saas_settings/config/adminUids
          -> admins/{uid} document created
          -> OTP doc deleted
Step 7: Redirected to /login
Step 8: Login -> onAuthStateChanged -> navigate to /tenants
```
**Result:** ✅ Flow is complete and well-structured.

### Simulation #2: Create Tenant + Doctor
```
Step 1: Admin creates clinic (tenant)
          -> saas_tenants doc + comm_tenants mirror
          -> Optional license auto-created
Step 2: Admin clicks "Add Doctor"
Step 3: Fills bilingual name, email, phone, specialization, selects tenant
Step 4: Clicks save
          -> saas_doctors doc created (doc ID = uid)
          -> POST /api/admin/create-doctor-auth { email, password, uid }
          -> If Auth fails: saas_doctors doc deleted (rollback)
          -> comm_doctor_users/{email} doc created
          -> comm_doctors mirror doc created
          -> comm_tenants doc ensured (for public listing)
```
**Result:** ⚠️ Rollback gap exists (see Issue #2).

### Simulation #3: Issue License
```
Step 1: Admin navigates to /licenses
Step 2: Clicks "Issue License" -> fills doctor name, phone, expiry
Step 3: Saves -> saas_licenses doc with ID = licenseKey
Step 4: Admin can toggle status ACTIVE/INACTIVE
Step 5: Admin can toggle onlineBooking
```
**Result:** ✅ Clean CRUD with no complex state machine.

### Simulation #4: Procurement PO Workflow
```
Step 1: Create supplier -> suppliers/{autoId}
Step 2: Create PO (DRAFT) -> purchase_orders/{poId} + purchase_order_items
Step 3: Submit PO (SUBMITTED) -> updateDoc()
Step 4: Approve PO -> POST /api/admin/procurement-approve
          -> Validates status == SUBMITTED -> updates to APPROVED
Step 5: Mark ORDERED -> updateDoc() directly (no API validation)
Step 6: Create goods receipt (DRAFT) -> goods_receipts + goods_receipt_items
Step 7: Complete goods receipt -> POST /api/admin/procurement-receive
          -> Updates inventory (stock, avg cost, movement)
          -> Updates PO status (RECEIVED / PARTIALLY_RECEIVED)
Step 8: Close PO -> updateDoc() directly
```
**Result:** ⚠️ Only Step 4 is validated server-side. Steps 3, 5, 8 have no state machine enforcement (see Issue #1).

### Simulation #5: Inventory Stock Adjustment
```
Step 1: Admin navigates to Inventory -> Items
Step 2: Selects an item, clicks "Adjust"
Step 3: Enters actual quantity, reason (DAMAGE/LOSS/etc.), notes
Step 4: POST /api/admin/inventory-adjustment
          -> Reads current stock
          -> Creates adjustment record
          -> Creates movement (ADJUSTMENT type)
          -> Updates item.currentStock
          -> Audit log entry
```
**Result:** ✅ Clean end-to-end, uses batch writes for atomicity.

### Simulation #6: Stock Count + Reconciliation
```
Step 1: Admin creates stock count (SCHEDULED)
Step 2: Admin counts items, enters actual quantities
Step 3: POST /api/admin/inventory-stock-count
          -> For each item with discrepancy:
             - Creates adjustment (MANUAL, APPROVED)
             - Creates movement
             - Updates item stock
             - Audit log
Step 4: Stock count marked COMPLETED
```
**Result:** ⚠️ Missing: STOCK_COUNT_UPDATED / STOCK_COUNT_COMPLETED audit log events. Items that are not found in the DB are silently skipped.

### Simulation #7: App Version Publish
```
Step 1: Admin navigates to /updates
Step 2: Clicks publish on app card (DR/SEC/Server)
Step 3: Fills version, build number, download URLs, release notes
Step 4: Saves -> app_versions/{appId} + releases subcollection entry
Step 5: Clinic servers poll for updates
```
**Result:** ✅ Clean flow.

---

## 6. Input Validation Coverage

### Client-Side Validation

| Module | File | Validates | Missing |
|---|---|---|---|
| Inventory | inventoryValidation.js | SKU format, bilingual name, unit, category, quantity | ❌ No barcode validation, no price range validation |
| Procurement | procurementValidation.js | PO state machine, PO number format, item quantities, supplier name | ❌ No supplier tax ID validation, no PO total validation |
| License | licenseTemplates.js | Plan templates, module names | ✅ Sufficient for its purpose |

### Server-Side (API) Validation

| API | Validates | Missing |
|---|---|---|
| register-request | Email format, password length | ❌ No rate limiting per IP |
| register-verify | Email, OTP, name, password, expiry, attempts | ❌ No rate limiting per IP |
| create-doctor-auth | Email, password >= 8, uid | ✅ Sufficient |
| inventory-adjustment | tenantId, itemId, reason (enum), actualQty (number) | ✅ Sufficient |
| inventory-batch-create | SKU, bilingual name, unit, category, SKU uniqueness | ❌ No limit on batch size (could exceed Firestore batch limit) |
| inventory-stock-count | tenantId, countDate (truthy only), items array | ❌ No date format validation |
| procurement-approve | poId, tenantId, status transition | ✅ Sufficient |
| procurement-receive | receiptId, tenantId, status transition | ✅ Sufficient |

---

## 7. Summary of Findings

### Critical Issues (must fix)
1. **PO state machine not enforced server-side** — Only SUBMITTED->APPROVED is validated via API. Other transitions (DRAFT→SUBMITTED, APPROVED→ORDERED, etc.) are client-side only with no Firestore rule or API enforcement.
2. **Doctor creation rollback gap** — Orphan Auth user if Firestore writes fail after Auth success
3. **.env.example uses NEXT_PUBLIC_* instead of VITE_*** — Will confuse local dev setup

### Moderate Issues (should fix)
5. **Tenant delete incomplete** — Does not cascade to saas_doctors, licenses, inventory, procurement
6. **No sync queue cleanup** — Stale FAILED items accumulate indefinitely
7. **countDate validation weak** — Only checks truthiness, not format
8. **Silent skip of non-existent items in stock count** — User not notified

### Minor Issues (nice to fix)
9. **comm_patients allows anonymous creates** — Unauthenticated patient record insertion
10. **No IP rate limiting on API routes** — No protection against brute force on OTP endpoints
11. **Audit log writes outside batch** — Individual writes could fail independently
12. **No test framework** — Zero tests for 8,900 lines of code

### What Works Well ✅
- Batch writes for atomic inventory operations (adjustments, stock counts, goods receipt)
- Server-side auth verification for all API routes
- Dual-write pattern for tenant/doctor data
- Security rules with 4 access levels
- CORS headers on all API routes
- OTP hashing + expiry + attempt tracking
- Clean separation of client and server Firebase SDKs
