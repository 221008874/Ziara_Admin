# Phase 18 — Inventory Module Architecture (Pre-Design)

> **Status:** Design — not implemented
> **Pattern Reference:** Existing ERP integration (Phase 17C), Tenants/Doctors dual-write, Firestore service layer
> **Language:** JavaScript (JSX) — no TypeScript, matching project convention

---

## 1. Architecture Overview

### Layer Stack

```
Page (JSX)
  → Component (MUI styled, shared PageShells)
    → Hook (custom useInventory hooks)
      → Service (firestoreService.js — extended with inventory functions)
        → Repository (Firebase Client SDK — collection(), doc(), query(), etc.)
          → Firestore (5 new collections: inventory_categories, inventory_items, inventory_movements, inventory_adjustments, inventory_stock_counts)
```

### Key Architectural Decisions

| Decision | Rationale |
|---|---|
| **Single Page, Tabbed UI** | Inventory has interdependent data (items reference categories, movements reference items, adjustments reference items). A single `/inventory` page with tabs avoids cross-page state sync. |
| **All Tenant-Scoped** | Every inventory collection carries `tenantId`. All queries filter by tenant. No global inventory. |
| **Atomic Movement → Stock Update** | Creating a movement also updates the item's `currentStock` and `averageCost` in the same operation (batch write). One movement = one atomic stock change. |
| **Soft Delete via Status** | Items marked `status: "DELETED"` instead of hard-deleted. Categories similarly (`DELETED`). Movements and adjustments are immutable — never deleted. |
| **No Dual-Write** | Inventory is admin-only (`saas_` namespace). No public mirror needed (community app does not need inventory). |
| **Average Cost on Purchase** | When a PURCHASE movement occurs, recalculate `averageCost = (oldStock * oldAvgCost + qty * unitCost) / (oldStock + qty)`. |
| **No Bilingual Fields** | Inventory items (SKU, itemCode), categories (name is internal label), movements (system-generated) do not need EN/AR. Exception: category name _is_ bilingual to match existing patterns. |

### File Map (Additions Only)

```
clinic-admin/
  src/
    pages/
      Inventory.jsx                 NEW — Main inventory page (tabbed: Items, Categories, Movements, Stock Counts)
    services/
      firestoreService.js           EXTEND — Add inventory functions (~250 new lines at end, after ERP section)
    lib/
      inventoryValidation.js        NEW — Validation rules for inventory fields
    components/
      Sidebar.jsx                   EXTEND — Add "Inventory" nav item under Management section
  api/
    admin/
      inventory-adjustment.js       NEW — Serverless API for privileged adjustment approval (signs off)
      inventory-batch-create.js     NEW — Bulk import items via CSV/JSON (admin-only)
      inventory-stock-count.js      NEW — Submit stock count batch with admin sign-off
  firestore.rules                   EXTEND — Add rules for 5 new collections (admin-only)
```

---

## 2. Collection Schemas

### 2.1 `inventory_categories`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants (tenant isolation) |
| `name` | `{ en: string, ar: string }` | yes | — | Bilingual category name |
| `description` | string | no | `""` | Optional description |
| `parentId` | string | no | `null` | Optional parent category (hierarchical) |
| `status` | string | yes | `"ACTIVE"` | `ACTIVE` / `INACTIVE` / `DELETED` |
| `sortOrder` | number | no | `0` | Display ordering |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |
| `updatedAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

### 2.2 `inventory_items`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `categoryId` | string | yes | — | FK to inventory_categories |
| `SKU` | string | yes | — | Stock Keeping Unit (unique per tenant) |
| `itemCode` | string | no | `""` | Optional internal code (unique per tenant) |
| `name` | `{ en: string, ar: string }` | yes | — | Bilingual item name |
| `unit` | string | yes | — | `"piece"`, `"box"`, `"bottle"`, `"pack"`, `"kg"`, `"liter"`, etc. |
| `currentStock` | number | auto | `0` | Calculated from movements |
| `reorderLevel` | number | no | `0` | Low-stock threshold |
| `averageCost` | number | auto | `0` | Weighted average cost per unit |
| `sellingPrice` | number | no | `0` | Recommended selling price |
| `batchTracked` | boolean | no | `false` | If true, requires batch/lot tracking |
| `expiryTracked` | boolean | no | `false` | If true, requires expiry date per batch |
| `imageUrl` | string | no | `""` | Item image (Cloudinary, same pattern as doctor photos) |
| `status` | string | yes | `"ACTIVE"` | `ACTIVE` / `INACTIVE` / `DELETED` / `OUT_OF_STOCK` |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |
| `updatedAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

**Composite Unique Constraints** (enforced in service layer):
- One SKU per tenant
- One itemCode per tenant (if provided)

### 2.3 `inventory_movements`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `itemId` | string | yes | — | FK to inventory_items |
| `type` | string | yes | — | `PURCHASE` / `CONSUMPTION` / `RETURN` / `ADJUSTMENT` / `TRANSFER` / `OPENING_BALANCE` |
| `quantity` | number | yes | — | Positive integer (+10 for inbound, -5 for consumption) |
| `unitCost` | number | no | `0` | Cost per unit (required for PURCHASE, specifies the purchase price for this batch) |
| `totalCost` | number | auto | — | `quantity * unitCost` (abs, for reference) |
| `stockBefore` | number | yes | — | Snapshot of item.currentStock before this movement |
| `stockAfter` | number | yes | — | Snapshot of item.currentStock after this movement |
| `referenceType` | string | no | `null` | `"adjustment"` / `"stock_count"` / `"transfer_out"` / etc. |
| `referenceId` | string | no | `null` | Document ID of the reference (adjustment, stock count, etc.) |
| `notes` | string | no | `""` | Admin notes |
| `createdBy` | string | yes | — | Admin UID who made the change |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

**Indexes Required:**
- `tenantId` + `itemId` + `createdAt` (desc) — per-item movement history
- `tenantId` + `type` + `createdAt` (desc) — filter by movement type
- `tenantId` + `createdAt` (desc) — global movement timeline

### 2.4 `inventory_adjustments`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `itemId` | string | yes | — | FK to inventory_items |
| `reason` | string | yes | — | `"DAMAGE"` / `"LOSS"` / `"FOUND"` / `"EXPIRY"` / `"MANUAL"` |
| `expectedQty` | number | yes | — | What the system thinks (item.currentStock at time of adjustment) |
| `actualQty` | number | yes | — | What was physically counted |
| `difference` | number | auto | — | `actualQty - expectedQty` |
| `notes` | string | no | `""` | Admin notes |
| `status` | string | yes | `"PENDING"` | `PENDING` / `APPROVED` / `REJECTED` |
| `approvedBy` | string | no | `null` | Admin UID who approved |
| `approvedAt` | Timestamp | no | `null` | Approval timestamp |
| `createdBy` | string | yes | — | Admin UID who created |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |
| `updatedAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

**Flow:**
1. Admin creates adjustment (PENDING) — writes to inventory_adjustments only
2. Admin (or same admin) approves — triggers movement creation + stock update
3. On APPROVED: creates an ADJUSTMENT movement with `referenceId: adjustmentDoc.id`, updates item.currentStock

### 2.5 `inventory_stock_counts`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `countDate` | string | yes | — | `"YYYY-MM-DD"` — date of physical count |
| `status` | string | yes | `"SCHEDULED"` | `SCHEDULED` / `IN_PROGRESS` / `COMPLETED` / `RECONCILED` |
| `items` | array | yes | `[]` | Array of `{ itemId, expectedQty, actualQty, difference, notes }` |
| `totalDiscrepancy` | number | auto | — | Sum of all `|difference|` |
| `reconciledAt` | Timestamp | no | `null` | When discrepancies were resolved |
| `reconciledBy` | string | no | `null` | Admin UID who reconciled |
| `createdBy` | string | yes | — | Admin UID who scheduled |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |
| `updatedAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

**Flow:**
1. Schedule: create with `status: "SCHEDULED"`, empty items array
2. Count: update items array with counted qty per item, set `status: "COMPLETED"`
3. Reconcile: for each item with `actualQty !== expectedQty`, create adjustment(s) OR directly create movements. Set `status: "RECONCILED"`

### 2.6 `inventory_audit_log` (Append-Only)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | Tenant scope |
| `action` | string | yes | — | `"MOVEMENT"` / `"ADJUSTMENT_CREATED"` / `"ADJUSTMENT_APPROVED"` / `"STOCK_COUNT_CREATED"` / `"STOCK_COUNT_RECONCILED"` / `"ITEM_CREATED"` / `"ITEM_STATUS_CHANGED"` / `"CATEGORY_CREATED"` / `"CATEGORY_STATUS_CHANGED"` |
| `entityType` | string | yes | — | `"item"` / `"category"` / `"movement"` / `"adjustment"` / `"stock_count"` |
| `entityId` | string | yes | — | Document ID of the entity |
| `details` | map | no | `{}` | Before/after snapshots, notes |
| `performedBy` | string | yes | — | Admin UID |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

---

## 3. Service Design

### 3.1 Pattern — Extend `firestoreService.js`

All inventory functions added to the existing file, after the ERP SaaS section (line 942). Same pattern as existing:
- `export const` functions
- Firebase Client SDK (`db` from `../firebase`)
- `serverTimestamp()` for timestamps
- Debug logging via `debug.js`

### 3.2 Categories (`firestoreService.js` — INVENTORY block)

```js
// ─── INVENTORY: Categories ─────────────────────────────────────────────────
export const createCategory = async (data) => { /* addDoc, bilingual name */ }
export const getAllCategories = async (tenantId) => { /* query by tenantId + orderBy sortOrder */ }
export const updateCategory = async (categoryId, updates) => { /* updateDoc + audit log */ }
export const deleteCategory = async (categoryId) => { /* soft delete: set status=DELETED */ }
  // Check no active items reference this category before allowing delete
```

### 3.3 Items

```js
// ─── INVENTORY: Items ──────────────────────────────────────────────────────
export const createItem = async (data) => { /* addDoc, validate SKU uniqueness per tenant */ }
export const getAllItems = async (tenantId, filters = {}) => {
  /* query by tenantId + optional status / categoryId filters */
  /* filter out DELETED by default */
}
export const getItemById = async (itemId) => { /* getDoc */ }
export const updateItem = async (itemId, updates) => { /* updateDoc + audit log */ }
export const deleteItem = async (itemId) => { /* soft delete: set status=DELETED */ }
export const getLowStockItems = async (tenantId) => {
  /* query items where currentStock <= reorderLevel && status === "ACTIVE" */
}
```

### 3.4 Movements

```js
// ─── INVENTORY: Movements ──────────────────────────────────────────────────
export const createMovement = async (data) => {
  /* 1. Get item current stock */
  /* 2. Calculate stockBefore = item.currentStock */
  /* 3. Calculate stockAfter = stockBefore + data.quantity (quantity is signed: + inbound, - outbound) */
  /* 4. If PURCHASE and data.unitCost is provided, recalculate averageCost:
        newAvgCost = (oldStock * oldAvgCost + qty * unitCost) / (oldStock + qty)
        If oldStock + qty === 0, avgCost = unitCost */
  /* 5. Batch write:
        - addDoc to inventory_movements
        - updateDoc inventory_items: { currentStock: stockAfter, averageCost: newAvgCost, updatedAt }
        - addDoc to inventory_audit_log  */
}
export const getMovementsByItem = async (itemId, tenantId) => {
  /* query by tenantId + itemId, orderBy createdAt desc */
}
export const getMovementsByType = async (tenantId, type) => {
  /* query by tenantId + type, orderBy createdAt desc */
}
export const getAllMovements = async (tenantId, opts = {}) => {
  /* paginated: tenantId + orderBy createdAt desc, optional limit */
}
```

### 3.5 Adjustments

```js
// ─── INVENTORY: Adjustments ────────────────────────────────────────────────
export const createAdjustment = async (data) => {
  /* addDoc to inventory_adjustments with status: "PENDING"
     audit log: ADJUSTMENT_CREATED */
}

export const approveAdjustment = async (adjustmentId, adminUid) => {
  /* 1. Get adjustment doc (must be PENDING) */
  /* 2. Create ADJUSTMENT movement with quantity = difference
     (movement's createMovement handles stock update + avgCost recalculation) */
  /* 3. Update adjustment: status=APPROVED, approvedBy, approvedAt
     audit log: ADJUSTMENT_APPROVED */
}

export const rejectAdjustment = async (adjustmentId) => {
  /* updateDoc: status=REJECTED */
}

export const getPendingAdjustments = async (tenantId) => {
  /* query by tenantId + status === "PENDING" */
}

export const getAllAdjustments = async (tenantId) => {
  /* query by tenantId, orderBy createdAt desc */
}
```

### 3.6 Stock Counts

```js
// ─── INVENTORY: Stock Counts ────────────────────────────────────────────────
export const createStockCount = async (data) => { /* addDoc with status SCHEDULED */ }
export const updateStockCountItems = async (countId, countedItems) => {
  /* Update the items array with actual quantities */
}
export const completeStockCount = async (countId) => { /* status=COMPLETED */ }
export const reconcileStockCount = async (countId, adminUid) => {
  /* For each item with discrepancy, create an adjustment OR direct movement
     Update status=RECONCILED, reconciledAt, reconciledBy */
}
export const getAllStockCounts = async (tenantId) => { /* query by tenantId */ }
```

### 3.7 Audit Log

```js
// ─── INVENTORY: Audit Log (internal) ───────────────────────────────────────
// Not exported — called by other inventory functions internally
async function writeInventoryAuditLog({ tenantId, action, entityType, entityId, details, performedBy }) {
  /* addDoc to inventory_audit_log */
}
export const getInventoryAuditLog = async (tenantId, entityType = null, entityId = null) => {
  /* query by tenantId + optional entityType + entityId filters */
}
```

### 3.8 Inventory Validation (`src/lib/inventoryValidation.js`)

```js
// Pattern: Same as erpValidation.js — pure functions returning error arrays

export const MOVEMENT_TYPES = ["PURCHASE", "CONSUMPTION", "RETURN", "ADJUSTMENT", "TRANSFER", "OPENING_BALANCE"];
export const ITEM_UNITS = ["piece", "box", "bottle", "pack", "kg", "liter", "meter", "strip", "vial", "other"];
export const ADJUSTMENT_REASONS = ["DAMAGE", "LOSS", "FOUND", "EXPIRY", "MANUAL"];
export const ITEM_STATUSES = ["ACTIVE", "INACTIVE", "DELETED", "OUT_OF_STOCK"];
export const CATEGORY_STATUSES = ["ACTIVE", "INACTIVE", "DELETED"];
export const STOCK_COUNT_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "RECONCILED"];
export const ADJUSTMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export function validateSKU(sku) { /* non-empty, alphanumeric + hyphens */ }
export function validateQuantity(qty) { /* positive integer, not zero for movements */ }
export function validateUnitCost(cost) { /* non-negative number */ }
export function validateItemName(name) { /* bilingual required — uses isBilingual() */ }
export function validateMovementType(type) { /* must be in MOVEMENT_TYPES */ }
export function validateInventoryItem(data) { /* returns { valid, errors } object */ }
export function validateCategory(data) { /* returns { valid, errors } object */ }
export function validateAdjustment(data) { /* returns { valid, errors } object */ }
```

---

## 4. API Design

### 4.1 Pattern

Same as existing Vercel serverless functions:
- ES module (`export default async function handler(req, res)`)
- CORS preflight
- `firebase-admin` initialized with `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`
- Validation before processing
- JSON response

### 4.2 `POST /api/admin/inventory-adjustment`

**Purpose:** Adjust stock with approval workflow. This API is the privileged endpoint that both creates and approves adjustments in one call (for trusted admin actions). The client-side flow uses two-step (create PENDING → approve).

**Input:**
```json
{
  "tenantId": "string",
  "itemId": "string",
  "reason": "DAMAGE|LOSS|FOUND|EXPIRY|MANUAL",
  "actualQty": "number",
  "notes": "string (optional)"
}
```

**Process:** Creates adjustment (APPROVED immediately) → Creates movement → Updates stock in batch

### 4.3 `POST /api/admin/inventory-batch-create`

**Purpose:** Bulk import items from JSON array. Admin-only privileged operation.

**Input:**
```json
{
  "tenantId": "string",
  "items": [
    {
      "categoryId": "string",
      "SKU": "string",
      "name": { "en": "string", "ar": "string" },
      "unit": "string",
      "reorderLevel": "number (optional)",
      "sellingPrice": "number (optional)"
    }
  ]
}
```

**Process:**
- Validates each item (SKU format, name required, unit in allowed list)
- Checks SKU uniqueness within the batch and against existing items for this tenant
- Batch writes all items
- Returns `{ created: count, errors: [{ index, reason }] }`

### 4.4 `POST /api/admin/inventory-stock-count`

**Purpose:** Submit a completed stock count with admin sign-off. API creates the adjustments for all discrepancies automatically.

**Input:**
```json
{
  "tenantId": "string",
  "countDate": "YYYY-MM-DD",
  "items": [
    { "itemId": "string", "actualQty": "number", "notes": "string (optional)" }
  ]
}
```

**Process:**
- Creates stock_count doc (`status: COMPLETED`)
- For each item with `actualQty !== expectedQty`, creates an APPROVED adjustment + movement
- Returns summary: `{ stockCountId, adjustmentsCreated, discrepanciesResolved }`

---

## 5. UI Design

### 5.1 Page Structure

**Single page: `/inventory`** — `src/pages/Inventory.jsx`

Layout (matching existing pattern):
```
PageContainer (min-height:100vh, bg:#04091a, margin-left responsive)
├── Background glows (radial-gradient blur circles)
├── TopBar (gradient header with logo + title + "New Item" action button)
├── ContentWrapper
│   ├── Stats Row (Total Items, Low Stock, Categories, Inbound this month)
│   ├── Tabs (Items | Categories | Movements | Adjustments | Stock Counts)
│   └── Tab Content:
│       ├── Items Tab:
│       │   ├── Search bar + Filter chips (status, category)
│       │   ├── Table: SKU, Name, Category, Unit, Stock, Reorder Level, Avg Cost, Selling Price, Status, Actions
│       │   ├── Create/Edit Dialog (BilingualInput for name, category select, unit select, reorder, price)
│       │   └── Quick Actions: "Add Stock" (opens movement dialog), "Adjust" (opens adjustment dialog)
│       │
│       ├── Categories Tab:
│       │   ├── Table: Name (EN/AR), Parent, Items Count, Status, Sort Order, Actions
│       │   └── Create/Edit Dialog (BilingualInput, parent select, sort order)
│       │
│       ├── Movements Tab:
│       │   ├── Filter row: movement type dropdown, date range, item search
│       │   ├── Table: Date, Type, Item, Qty (± colored), Stock Before → After, Unit Cost, Notes, By
│       │   └── "New Movement" FAB/dialog:
│       │       ├── Select item (searchable dropdown)
│       │       ├── Movement type (PURCHASE/CONSUMPTION/RETURN/TRANSFER/OPENING_BALANCE)
│       │       ├── Quantity (positive; sign determined by type)
│       │       ├── Unit Cost (shown for PURCHASE, optional)
│       │       └── Notes
│       │
│       ├── Adjustments Tab:
│       │   ├── Filter: status (PENDING/APPROVED/REJECTED)
│       │   ├── Table: Date, Item, Reason, Expected → Actual, Difference, Status, Approve/Reject buttons
│       │   └── "New Adjustment" dialog:
│       │       ├── Select item, reason, actual quantity
│       │       └── Shows calculated difference
│       │
│       └── Stock Counts Tab:
│           ├── Table: Date, Status, Items Counted, Discrepancies, Reconciled
│           ├── "Schedule Count" button → opens dialog (select date)
│           └── "Count Items" action → opens item listing with expected/actual input
```

### 5.2 Routes

```jsx
// App.jsx additions:
import Inventory from "./pages/Inventory";

<Route path="/inventory" element={<Inventory />} />
```

```jsx
// Sidebar.jsx NAV_ITEMS additions:
{
  section: "Management",
  items: [
    // ... existing items ...
    { to: "/inventory", icon: "📦", label: "Inventory" },
  ],
}
```

### 5.3 Dialog Components (Inside Inventory.jsx)

All dialogs follow the existing pattern:
- `StyledDialog` (maxWidth="md", fullWidth, dark theme matching existing)
- `StyledField` / `StyledSelect` (reuse from existing page patterns)
- `BilingualInput` for name fields (category, item)
- `ActionButton` for primary/secondary/danger

**Item Create/Edit Dialog Fields:**
- `BilingualInput` for item name
- Category dropdown (from inventory_categories, filtered by tenant)
- SKU (text, validated for uniqueness)
- Item Code (text, optional)
- Unit dropdown: piece, box, bottle, pack, kg, liter, meter, strip, vial, other
- Reorder Level (number, default 0)
- Selling Price (number, default 0)
- Batch Tracked toggle (boolean)
- Expiry Tracked toggle (boolean)

**Movement Create Dialog Fields:**
- Item searchable autocomplete (must be ACTIVE)
- Movement type dropdown (PURCHASE/CONSUMPTION/RETURN/TRANSFER/OPENING_BALANCE)
- Quantity (positive number; UI shows inbound/outbound based on type)
- Unit Cost (shown for PURCHASE, hidden for CONSUMPTION)
- Notes (text, optional)

**Adjustment Create Dialog Fields:**
- Item autocomplete
- Reason dropdown: DAMAGE, LOSS, FOUND, EXPIRY, MANUAL
- Expected Qty (read-only, fetched from item.currentStock)
- Actual Qty (number input)
- Difference (calculated, read-only)
- Notes (optional)

### 5.4 Stats Row

```
┌──────────────┬──────────────┬──────────────┬──────────────────┐
│ Total Items  │ Low Stock    │ Categories   │ Inbound This Mo  │
│     342      │      12      │      8       │    1,247 units   │
└──────────────┴──────────────┴──────────────┴──────────────────┘
```

### 5.5 Color Coding

- **Stock level:** Green (normal), Yellow (below reorder), Red (zero stock)
- **Movement quantity:** Green text for inbound (+), Red text for outbound (-)
- **Adjustment status:** Amber (PENDING), Green (APPROVED), Red (REJECTED)
- **Item status:** Green (ACTIVE), Gray (INACTIVE), Red (DELETED), Yellow (OUT_OF_STOCK)

---

## 6. Security Design

### 6.1 Firestore Rules (`firestore.rules`)

```
match /inventory_categories/{categoryId} {
  allow read, write: if isAnyAdmin();
}

match /inventory_items/{itemId} {
  allow read, write: if isAnyAdmin();
}

match /inventory_movements/{movementId} {
  allow read: if isAnyAdmin();
  allow create: if isAnyAdmin();
  allow update, delete: if false;  // Immutable
}

match /inventory_adjustments/{adjustmentId} {
  allow read: if isAnyAdmin();
  allow create: if isAnyAdmin();
  allow update: if isAnyAdmin();  // Status changes (approve/reject)
  allow delete: if false;
}

match /inventory_stock_counts/{countId} {
  allow read, write: if isAnyAdmin();
}

match /inventory_audit_log/{logId} {
  allow read: if isAnyAdmin();
  allow create: if isAnyAdmin();   // Server-side writes
  allow update, delete: if false;  // Append-only
}
```

### 6.2 Tenant Isolation

Every document in every inventory collection carries `tenantId`. All queries filter by `tenantId`. The Firestore rules check `isAnyAdmin()` but do not check tenantId in the rules layer — tenant isolation is enforced at the **service layer**:
- All `getAll*` functions accept `tenantId` and filter by it
- All `create*` functions require `tenantId` in input data
- The UI always operates within a single tenant context

### 6.3 Audit Logging

All state-changing operations write to `inventory_audit_log`:
- Item create / status change
- Category create / status change
- Movement create
- Adjustment create / approve / reject
- Stock count create / complete / reconcile

The audit log is append-only (no update/delete in rules).

### 6.4 Permission Enforcement

- **Admin-only:** All inventory operations require `admin: true` custom claim (same as all saas_* operations)
- **API routes:** Serverless functions validate admin claim via `admin.verifyIdToken()` before processing
- **No public access:** Inventory is never exposed to community app

### 6.5 Soft Delete Compatibility

- `items.status = "DELETED"` — items are hidden from default queries, but movements/history remain intact
- `categories.status = "DELETED"` — service layer prevents deletion if active items reference the category
- Movements and adjustments are **immutable** — never deleted, never updated
- Stock counts can be cancelled (status changed) but never deleted

### 6.6 Data Integrity (Service Layer)

| Constraint | Enforcement |
|---|---|
| SKU unique per tenant | Query existing items before create; reject if duplicate |
| Movement → stock consistency | Movement always written in batch with item stock update |
| No negative stock | `stockAfter` must be >= 0 for CONSUMPTION movements (configurable, can allow negative for flexibility) |
| Adjustment → movement | Approval always creates a movement atomically |
| Category → items | Delete category only if no ACTIVE items reference it |

---

## 7. Firestore Composite Indexes

### Required Indexes

| Collection | Fields | Purpose |
|---|---|---|
| `inventory_items` | `tenantId` ASC, `createdAt` DESC | Main listing page |
| `inventory_items` | `tenantId` ASC, `status` ASC, `createdAt` DESC | Filter by status |
| `inventory_items` | `tenantId` ASC, `categoryId` ASC, `createdAt` DESC | Filter by category |
| `inventory_items` | `tenantId` ASC, `currentStock` ASC, `status` ASC | Low stock query |
| `inventory_movements` | `tenantId` ASC, `createdAt` DESC | Global movement list |
| `inventory_movements` | `tenantId` ASC, `itemId` ASC, `createdAt` DESC | Per-item movement history |
| `inventory_movements` | `tenantId` ASC, `type` ASC, `createdAt` DESC | Filter by movement type |
| `inventory_adjustments` | `tenantId` ASC, `createdAt` DESC | Adjustment list |
| `inventory_adjustments` | `tenantId` ASC, `status` ASC, `createdAt` DESC | Pending adjustments |
| `inventory_stock_counts` | `tenantId` ASC, `createdAt` DESC | Stock count list |
| `inventory_audit_log` | `tenantId` ASC, `createdAt` DESC | Audit log listing |
| `inventory_audit_log` | `tenantId` ASC, `entityType` ASC, `entityId` ASC | Filter by entity |

---

## 8. Implementation Order

| Step | Description | Depends On |
|---|---|---|
| 1 | Create `inventoryValidation.js` (validation functions) | Nothing |
| 2 | Add Firestore indexes (via Firebase Console or CLI) | Nothing |
| 3 | Update `firestore.rules` with new collection rules | Nothing |
| 4 | Add Category functions to `firestoreService.js` | Step 1 |
| 5 | Add Item functions to `firestoreService.js` | Step 4 |
| 6 | Add Movement functions to `firestoreService.js` | Step 5 |
| 7 | Add Adjustment functions to `firestoreService.js` | Step 6 |
| 8 | Add Stock Count functions to `firestoreService.js` | Step 5 |
| 9 | Create `api/admin/inventory-adjustment.js` | Step 7 |
| 10 | Create `api/admin/inventory-batch-create.js` | Step 5 |
| 11 | Create `api/admin/inventory-stock-count.js` | Step 8 |
| 12 | Create `src/pages/Inventory.jsx` with all tabs | Steps 4-8 |
| 13 | Update `Sidebar.jsx` NAV_ITEMS | Step 12 |
| 14 | Update `App.jsx` route | Step 12 |
| 15 | Verify build + lint | All |

---

## 9. Integration with Existing ERP

The Inventory module does not require ERP integration. However, future phases could:

- **ERP license gating:** Check `enabledModules.includes("inventory")` before allowing inventory operations on a tenant (the module key already exists in `licenseTemplates.js` `ALL_MODULES`)
- **Usage tracking:** Expose inventory counts to ERP for usage-based billing
- **Multi-warehouse:** Extend with TRANSFER type between warehouses (already in movement types)

---

## 10. Summary of New/Modified Files

| File | Action | Lines (est.) |
|---|---|---|
| `src/services/firestoreService.js` | EXTEND | +250 lines (after line 942) |
| `src/lib/inventoryValidation.js` | CREATE | +120 lines |
| `src/pages/Inventory.jsx` | CREATE | +800 lines |
| `api/admin/inventory-adjustment.js` | CREATE | +90 lines |
| `api/admin/inventory-batch-create.js` | CREATE | +100 lines |
| `api/admin/inventory-stock-count.js` | CREATE | +100 lines |
| `src/components/Sidebar.jsx` | EXTEND | +1 nav item |
| `src/App.jsx` | EXTEND | +1 import + 1 route |
| `firestore.rules` | EXTEND | +35 lines (5 collection rules) |
| `docs/ARCHITECTURE.md` | EXTEND | +Inventory section |
| `PROJECT_CONTEXT.md` | EXTEND | +Inventory sections |
| `PROJECT_MAP.md` | EXTEND | +Inventory entries |

---

*End of design document. Ready for review before implementation.*
