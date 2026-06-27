# Phase 19 — Procurement Module Architecture (Pre-Design)

> **Status:** Design — not implemented
> **Inventory Dependency:** Phase 18 (inventory_categories, inventory_items, inventory_movements)
> **Pattern Reference:** Phase 17C ERP integration, Phase 18 Inventory design, existing firestoreService.js patterns
> **Language:** JavaScript (JSX) — no TypeScript

---

## 1. Architecture Overview

### Layer Stack

```
Page (JSX) — /procurement
  → Component (MUI styled, same page shell as Inventory)
    → Service (firestoreService.js — extended with procurement functions)
      → Repository (Firebase Client SDK)
        → Firestore (5 new collections + 1 audit collection)

Inventory Integration Point:
  Procurement Service
    → calls createMovement() from Inventory service
      → batch-writes inventory_movements + updates inventory_items.currentStock + averageCost
```

### Core Workflow

```
Supplier ──→ Purchase Order ──→ Approval ──→ Goods Receipt ──→ Movement ──→ Stock Update
  ①             ②                 ③              ④              ⑤               ⑥
```

| Step | Action | Collection(s) Written |
|---|---|---|
| ① | Admin creates/edits suppliers | `suppliers` |
| ② | Admin creates PO (Draft) → submits (Submitted) | `purchase_orders`, `purchase_order_items` |
| ③ | Admin approves PO (Approved → Ordered) | `purchase_orders` status change |
| ④ | Goods received against PO items | `goods_receipts`, `goods_receipt_items` |
| ⑤ | System creates PURCHASE movement per line item | `inventory_movements` (via createMovement) |
| ⑥ | System updates item stock + average cost | `inventory_items` (via createMovement batch) |

### Key Architectural Decisions

| Decision | Rationale |
|---|---|
| **Inventory as Single Source of Truth** | Procurement never writes `currentStock` or `averageCost` directly. All stock mutations go through `inventory_movements.createMovement()`. |
| **Goods Receipt Triggers Movement** | Creating a goods_receipt_item automatically calls `createMovement({ type: "PURCHASE", itemId, quantity, unitCost, referenceType: "goods_receipt", referenceId })`. This is atomic — if movement fails, receipt fails. |
| **PO Items Can Be Non-Inventory** | Some POs may be for services or non-stocked items. If `inventoryItemId` is null, no movement is created on receipt. |
| **Status Machine in Service Layer** | PO status transitions are enforced in the service function — not in the UI. UI calls `submitPO()`, `approvePO()`, `receivePO()`, etc., each of which checks valid transitions. |
| **Single Admin Approval** | PO uses a simple PENDING→APPROVED model (matching inventory_adjustments). No multi-level workflow. |
| **No Dual-Write** | Procurement is admin-only. `saas_` prefix not needed — these are already admin-only via context. |
| **No Bilingual on System Fields** | PO numbers, dates, quantities are not bilingual. Supplier name _is_ bilingual (it's a user-facing record). |

### File Map (Additions Only)

```
clinic-admin/
  src/
    pages/
      Procurement.jsx               NEW — Main procurement page (tabbed: POs, Suppliers, Goods Receipts)
    services/
      firestoreService.js           EXTEND — Add procurement functions (~250 lines, after Inventory section)
    lib/
      procurementValidation.js      NEW — Validation for PO, supplier, goods receipt fields
    components/
      Sidebar.jsx                   EXTEND — Add "Procurement" nav item under Management section
  api/
    admin/
      procurement-approve.js        NEW — Serverless API for PO approval with admin token verification
      procurement-receive.js        NEW — Serverless API for goods receipt + auto-movement creation (transactional)
  firestore.rules                   EXTEND — Add rules for 5 new collections
```

---

## 2. Collection Schemas

### 2.1 `suppliers`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `name` | `{ en: string, ar: string }` | yes | — | Bilingual supplier name |
| `contactPerson` | string | no | `""` | Primary contact name |
| `email` | string | no | `""` | Contact email |
| `phone` | string | no | `""` | Contact phone |
| `address` | string | no | `""` | Physical address |
| `taxId` | string | no | `""` | Tax registration number |
| `paymentTerms` | string | no | `"NET30"` | `NET15` / `NET30` / `NET60` / `CASH` / `COD` |
| `status` | string | yes | `"ACTIVE"` | `ACTIVE` / `INACTIVE` / `DELETED` |
| `notes` | string | no | `""` | Free-text notes |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |
| `updatedAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

### 2.2 `purchase_orders`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `poNumber` | string | yes | — | Auto-generated: `"PO-{YYYY}-{XXXXX}"` (unique per tenant) |
| `supplierId` | string | yes | — | FK to suppliers |
| `supplierName` | string | yes | — | Denormalized snapshot (survives supplier rename) |
| `status` | string | yes | `"DRAFT"` | See lifecycle below |
| `orderDate` | string | no | `""` | `"YYYY-MM-DD"` — when ordered |
| `expectedDate` | string | no | `""` | `"YYYY-MM-DD"` — expected delivery |
| `receivedDate` | Timestamp | no | `null` | When fully received |
| `subtotal` | number | auto | `0` | Sum of (qty * unitCost) for all items |
| `taxAmount` | number | no | `0` | Tax total |
| `shippingCost` | number | no | `0` | Shipping/handling |
| `totalAmount` | number | auto | — | `subtotal + taxAmount + shippingCost` |
| `currency` | string | no | `"SAR"` | Currency code |
| `notes` | string | no | `""` | PO-level notes |
| `terms` | string | no | `""` | Purchase terms |
| `submittedBy` | string | no | `null` | Admin UID who submitted |
| `submittedAt` | Timestamp | no | `null` | Submission timestamp |
| `approvedBy` | string | no | `null` | Admin UID who approved |
| `approvedAt` | Timestamp | no | `null` | Approval timestamp |
| `orderedBy` | string | no | `null` | Admin UID who marked Ordered |
| `orderedAt` | Timestamp | no | `null` | Ordered timestamp |
| `closedBy` | string | no | `null` | Admin UID who closed |
| `closedAt` | Timestamp | no | `null` | Closure timestamp |
| `cancelledBy` | string | no | `null` | Admin UID who cancelled |
| `cancelledAt` | Timestamp | no | `null` | Cancellation timestamp |
| `cancellationReason` | string | no | `""` | Why cancelled |
| `createdBy` | string | yes | — | Admin UID who created |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |
| `updatedAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

**PO Number Generation (`poNumber`):**
```
PO-{currentYear}-{zero-padded sequential counter per tenant}
Example: PO-2026-00001
```
Stored in `procurement_meta/{tenantId}` doc as `{ lastPOCounter: number }`.

### 2.3 `purchase_order_items`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `poId` | string | yes | — | FK to purchase_orders |
| `lineNumber` | number | auto | — | Sequential 1-based per PO |
| `inventoryItemId` | string | no | `null` | FK to inventory_items (null = non-inventory item) |
| `itemName` | string | yes | — | Snapshot: item.name.en at time of PO creation |
| `itemNameAr` | string | no | `""` | Snapshot: item.name.ar |
| `SKU` | string | no | `""` | Snapshot of item.SKU (if inventory item) |
| `unit` | string | yes | — | `"piece"`, `"box"`, `"bottle"`, etc. (snapshot from item) |
| `quantityOrdered` | number | yes | — | Total quantity ordered |
| `quantityReceived` | number | auto | `0` | Running total received across all goods receipts |
| `quantityPending` | number | auto | — | `quantityOrdered - quantityReceived` |
| `unitCost` | number | yes | — | Cost per unit in PO currency |
| `totalCost` | number | auto | — | `quantityOrdered * unitCost` |
| `notes` | string | no | `""` | Line-item notes |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |
| `updatedAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

**Constraints:**
- One PO can have many items
- Items are immutable once PO status leaves DRAFT (no edit, only cancel line)
- `quantityReceived` is updated by goods receipt creation

### 2.4 `goods_receipts`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `poId` | string | yes | — | FK to purchase_orders |
| `receiptNumber` | string | yes | — | Auto-generated: `"GR-{YYYY}-{XXXXX}"` |
| `status` | string | yes | `"DRAFT"` | `DRAFT` / `COMPLETED` / `CANCELLED` |
| `receivedDate` | string | yes | — | `"YYYY-MM-DD"` — actual receipt date |
| `referenceNumber` | string | no | `""` | Supplier's delivery note / invoice number |
| `notes` | string | no | `""` | Receiving notes |
| `receivedBy` | string | yes | — | Admin UID who recorded receipt |
| `movementsCreated` | boolean | no | `false` | True after inventory movements are created |
| `cancelledBy` | string | no | `null` | Admin UID who cancelled |
| `cancelledAt` | Timestamp | no | `null` | Cancellation timestamp |
| `cancellationReason` | string | no | `""` | Why cancelled |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |
| `updatedAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

**Receipt Number Generation:** `GR-{YYYY}-{XXXXX}` with sequential counter (same pattern as PO).

### 2.5 `goods_receipt_items`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | FK to saas_tenants |
| `receiptId` | string | yes | — | FK to goods_receipts |
| `poItemId` | string | yes | — | FK to purchase_order_items |
| `inventoryItemId` | string | no | `null` | FK to inventory_items (resolved from poItem) |
| `lineNumber` | number | auto | — | Sequential 1-based per receipt |
| `itemName` | string | yes | — | Snapshot from PO item |
| `unit` | string | yes | — | Snapshot from PO item |
| `quantityOrdered` | number | yes | — | Copied from PO item at receipt time |
| `quantityPreviouslyReceived` | number | yes | — | Quantity received before this receipt |
| `quantityReceived` | number | yes | — | Quantity in this receipt |
| `quantityNowReceived` | number | auto | — | `quantityPreviouslyReceived + quantityReceived` |
| `quantityPending` | number | auto | — | `quantityOrdered - quantityNowReceived` |
| `unitCost` | number | yes | — | Copied from PO item at receipt time |
| `totalCost` | number | auto | — | `quantityReceived * unitCost` |
| `batchNumber` | string | no | `""` | Supplier batch/lot number |
| `expiryDate` | string | no | `""` | `"YYYY-MM-DD"` — if item is expiryTracked |
| `movementId` | string | no | `null` | FK to inventory_movements (created on completion) |
| `notes` | string | no | `""` | Line-item notes |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

**Movement Creation:**
When goods receipt status moves from DRAFT → COMPLETED:
- For each item where `inventoryItemId` is not null:
  - Call `createMovement({ type: "PURCHASE", itemId: inventoryItemId, quantity: +quantityReceived, unitCost, referenceType: "goods_receipt", referenceId: receiptId, tenantId, notes, createdBy: receivedBy })`
  - Store `movementId` on the goods_receipt_item
- Set `movementsCreated = true` on the goods_receipt header
- Update each `purchase_order_item.quantityReceived` with the cumulative total
- Recalculate PO status (see lifecycle)

### 2.6 `procurement_audit_log` (Append-Only)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `tenantId` | string | yes | — | Tenant scope |
| `action` | string | yes | — | `"SUPPLIER_CREATED"` / `"SUPPLIER_UPDATED"` / `"PO_CREATED"` / `"PO_SUBMITTED"` / `"PO_APPROVED"` / `"PO_ORDERED"` / `"PO_RECEIVED"` / `"PO_CLOSED"` / `"PO_CANCELLED"` / `"GR_CREATED"` / `"GR_COMPLETED"` / `"GR_CANCELLED"` / `"MOVEMENT_CREATED"` |
| `entityType` | string | yes | — | `"supplier"` / `"purchase_order"` / `"purchase_order_item"` / `"goods_receipt"` / `"goods_receipt_item"` |
| `entityId` | string | yes | — | Document ID |
| `details` | map | no | `{}` | Before/after status, related IDs, notes |
| `performedBy` | string | yes | — | Admin UID |
| `createdAt` | Timestamp | auto | — | serverTimestamp() |

**Document ID:** auto-generated (`addDoc`)

---

## 3. Purchase Order Lifecycle (State Machine)

```
                    ┌──────────┐
                    │  DRAFT   │
                    └────┬─────┘
                         │ submitPO()
                    ┌────▼─────┐
                    │ SUBMITTED│
                    └────┬─────┘
                         │ approvePO()
                    ┌────▼─────┐
                    │ APPROVED │
                    └────┬─────┘
                         │ markOrdered()
                    ┌────▼─────┐
                    │ ORDERED  │
                    └────┬─────┘
                         │ goods received (auto via GR)
              ┌──────────┼──────────┐
         all items    some items   no items
         received     received     received
              │            │            │
    ┌─────────▼──┐  ┌──────▼──────┐   │
    │  RECEIVED  │  │ PARTIALLY   │   │
    │            │  │ RECEIVED    │   │
    └─────────┬──┘  └──────┬──────┘   │
              │            │          │
              │  closePO() │          │
              └─────┬──────┘          │
                    │            ┌────▼─────┐
                    │            │  CLOSED  │ (manual)
                    │            └────┬─────┘
                    │                 │
                    │           also from any state:
                    │            ┌──────────┐
                    └───────────▶│ CANCELLED│
                                 └──────────┘
```

### State Transitions (enforced in service layer)

| From | To | Function | Conditions |
|---|---|---|---|
| DRAFT | SUBMITTED | `submitPO` | Must have ≥ 1 item with qty > 0 |
| SUBMITTED | APPROVED | `approvePO` | None |
| APPROVED | ORDERED | `markOrdered` | None |
| ORDERED | PARTIALLY_RECEIVED | (auto via GR) | At least one item has `quantityReceived > 0` and at least one has `quantityPending > 0` |
| ORDERED | RECEIVED | (auto via GR) | All items have `quantityReceived >= quantityOrdered` |
| PARTIALLY_RECEIVED | RECEIVED | (auto via GR) | All items now fully received |
| RECEIVED | CLOSED | `closePO` | All items received (normal closure) |
| ORDERED / PARTIALLY_RECEIVED / RECEIVED | CLOSED | `closePO` | Remaining pending items are force-closed |
| DRAFT / SUBMITTED / APPROVED / ORDERED | CANCELLED | `cancelPO` | Cannot cancel if any GR has movements created |
| CANCELLED | — | (terminal) | No transitions out |

### Service Functions for State Transitions

```js
export const createPO = async (data)            → { id, poNumber }   // status: DRAFT
export const updatePO = async (poId, updates)    → void              // only if DRAFT
export const submitPO = async (poId, adminUid)   → void              // DRAFT→SUBMITTED
export const approvePO = async (poId, adminUid)  → void              // SUBMITTED→APPROVED
export const markOrdered = async (poId, adminUid)→ void              // APPROVED→ORDERED
export const closePO = async (poId, adminUid)    → void              // RECEIVED→CLOSED or force-close
export const cancelPO = async (poId, reason, adminUid) → void        // *→CANCELLED
export const getPOById = async (poId)            → PurchaseOrder
export const getPOs = async (tenantId, filters)  → PurchaseOrder[]
```

---

## 4. Inventory Integration Model

### 4.1 The Golden Rule

> **Procurement never writes `currentStock` or `averageCost` on `inventory_items`.**
> All stock mutations go through `inventory_movements.createMovement()`.

### 4.2 Integration Flow (Goods Receipt → Stock Update)

```
User completes Goods Receipt (DRAFT → COMPLETED)
  │
  ├─ For each goods_receipt_item with inventoryItemId !== null:
  │     │
  │     ├─ Call createMovement({
  │     │     type: "PURCHASE",
  │     │     itemId: inventoryItemId,
  │     │     quantity: +quantityReceived,    // positive inbound
  │     │     unitCost: unitCost,
  │     │     referenceType: "goods_receipt",
  │     │     referenceId: receiptId,
  │     │     tenantId,
  │     │     notes: `GR ${receiptNumber} / PO ${poNumber} / ${itemName}`,
  │     │     createdBy: receivedBy,
  │     │   })
  │     │     │
  │     │     ├─ Writes inventory_movements document
  │     │     ├─ Updates inventory_items: currentStock += quantity
  │     │     ├─ Recalculates inventory_items: averageCost
  │     │     └─ Writes inventory_audit_log entry
  │     │
  │     └─ Store movementId on goods_receipt_item.movementId
  │
  ├─ Update each purchase_order_item.quantityReceived
  ├─ Recalculate PO status (ORDERED→PARTIALLY_RECEIVED→RECEIVED)
  └─ Write procurement_audit_log entry
```

### 4.3 Average Cost Update (Inside `createMovement`)

For PURCHASE movements specifically, `createMovement` recalculates:
```
newAvgCost = (oldStock * oldAvgCost + qty * unitCost) / (oldStock + qty)
```
- If `oldStock + qty === 0`, set `newAvgCost = unitCost`
- This is the same logic from the Inventory design — procurement simply triggers it

### 4.4 What Happens Per Movement Type

| GR Item Has inventoryItemId? | Movement Created | Stock Impact |
|---|---|---|
| Yes, item exists | PURCHASE movement (via createMovement) | `currentStock += receivedQty`, `averageCost` recalculated |
| No (service item) | None | None |

### 4.5 Cancellation / Reverse Movement

If a goods receipt is cancelled AFTER movements were created:
- A new CONSUMPTION or ADJUSTMENT movement is created with `quantity = -receivedQty`
- Reference links back to the cancellation
- This is a separate design concern — for v1, GR cannot be cancelled if movements were created. A separate `reverseGoodsReceipt` function can be added later.

---

## 5. Service Architecture

### 5.1 Pattern — Extend `firestoreService.js`

All procurement functions added to `firestoreService.js` after the Inventory section. Same conventions:
- `export const` functions
- `db` from `../firebase`
- `serverTimestamp()` for timestamps
- Debug logging via `debug.js`
- Batch writes for atomic operations

### 5.2 Suppliers

```js
// ─── PROCUREMENT: Suppliers ────────────────────────────────────────────────
export const createSupplier = async (data) => { /* addDoc, bilingual name */ }
export const getAllSuppliers = async (tenantId) => { /* query by tenantId, orderBy name */ }
export const getSupplierById = async (supplierId) => { /* getDoc */ }
export const updateSupplier = async (supplierId, updates) => { /* updateDoc + audit log */ }
export const deleteSupplier = async (supplierId) => { /* soft delete: status=DELETED */ }
  // Check no ACTIVE/ORDERED POs reference this supplier before allowing delete
```

### 5.3 Purchase Orders

```js
// ─── PROCUREMENT: Purchase Orders ──────────────────────────────────────────
export const createPO = async (data) => {
  /* 1. Generate poNumber from procument_meta/{tenantId} counter */
  /* 2. addDoc to purchase_orders with status: "DRAFT" */
  /* 3. For each item, addDoc to purchase_order_items, calculating lineNumber */
  /* 4. Calculate subtotal = sum(item.qtyOrdered * item.unitCost) */
  /* 5. Update PO doc with subtotal, totalAmount */
  /* 6. audit log: PO_CREATED */
  /* Returns { id, poNumber } */
}

export const getPOs = async (tenantId, filters = {}) => {
  /* query by tenantId, optional status filter, orderBy createdAt desc */
  /* Populate items array per PO via separate query or client-side join */
}

export const getPOById = async (poId) => {
  /* getDoc for PO + getDocs for items (where poId == poId) */
  /* Returns { ...poData, items: [...] } */
}

export const updatePO = async (poId, updates) => {
  /* Only allow if status === "DRAFT" */
  /* If items array is provided, replace all purchase_order_items */
}

export const submitPO = async (poId, adminUid) => {
  /* Validate: has items, all qty > 0 */
  /* Transition: DRAFT → SUBMITTED */
  /* Set submittedBy, submittedAt */
  /* audit log: PO_SUBMITTED */
}

export const approvePO = async (poId, adminUid) => {
  /* Transition: SUBMITTED → APPROVED */
  /* Set approvedBy, approvedAt */
  /* audit log: PO_APPROVED */
}

export const markOrdered = async (poId, adminUid, orderDate) => {
  /* Transition: APPROVED → ORDERED */
  /* Set orderedBy, orderedAt, orderDate */
  /* audit log: PO_ORDERED */
}

export const closePO = async (poId, adminUid) => {
  /* Transition: RECEIVED or PARTIALLY_RECEIVED → CLOSED */
  /* Set closedBy, closedAt */
  /* If PARTIALLY_RECEIVED, remaining items are force-closed */
  /* audit log: PO_CLOSED */
}

export const cancelPO = async (poId, reason, adminUid) => {
  /* Allowed from: DRAFT, SUBMITTED, APPROVED, ORDERED */
  /* NOT allowed if any goods_receipt has movementsCreated === true */
  /* Transition: * → CANCELLED */
  /* Set cancelledBy, cancelledAt, cancellationReason */
  /* audit log: PO_CANCELLED */
}

// Internal — recalculate PO status based on item receipt state
async function recalcPOStatus(poId, tenantId) {
  /* Query all purchase_order_items for this PO */
  /* If all items have quantityReceived >= quantityOrdered → RECEIVED */
  /* If any item has quantityReceived > 0 → PARTIALLY_RECEIVED */
  /* Else → stays ORDERED */
  /* Set receivedDate if transitioning to RECEIVED */
}
```

### 5.4 Goods Receipts

```js
// ─── PROCUREMENT: Goods Receipts ───────────────────────────────────────────
export const createGoodsReceipt = async (data) => {
  /* 1. Generate receiptNumber */
  /* 2. Validate PO exists and is in ORDERED / PARTIALLY_RECEIVED state */
  /* 3. For each item, validate quantityReceived <= PO item's quantityPending */
  /* 4. addDoc to goods_receipts with status: "DRAFT" */
  /* 5. For each item, addDoc to goods_receipt_items with:
        - quantityOrdered, quantityPreviouslyReceived (from PO item)
        - quantityReceived (from input), quantityNowReceived, quantityPending
        - unitCost, totalCost */
  /* 6. audit log: GR_CREATED */
  /* Returns { id, receiptNumber } */
}

export const completeGoodsReceipt = async (receiptId, adminUid) => {
  /* 1. Get goods_receipt + its items (must be DRAFT) */
  /* 2. For each item with inventoryItemId !== null:
        - Call createMovement({ type: "PURCHASE", itemId, quantity: +quantityReceived,
            unitCost, referenceType: "goods_receipt", referenceId: receiptId,
            tenantId, notes, createdBy: adminUid })
        - Store movementId on goods_receipt_item */
  /* 3. For each item, update purchase_order_item.quantityReceived:
        quantityReceived += item.quantityReceived */
  /* 4. Set status=COMPLETED, movementsCreated=true on goods_receipt */
  /* 5. Call recalcPOStatus() for the PO */
  /* 6. audit log: GR_COMPLETED + MOVEMENT_CREATED per item */
  /* Uses batch writes for atomicity */
}

export const cancelGoodsReceipt = async (receiptId, reason, adminUid) => {
  /* If movementsCreated === true → cannot cancel (v1 limitation) */
  /* Else → set status=CANCELLED, cancelledBy, cancelledAt */
  /* audit log: GR_CANCELLED */
}

export const getGoodsReceiptsByPO = async (poId) => {
  /* query goods_receipts where poId == poId */
}

export const getGoodsReceiptById = async (receiptId) => {
  /* getDoc for receipt + getDocs for items */
}
```

### 5.5 Audit Log

```js
// ─── PROCUREMENT: Audit Log (internal) ─────────────────────────────────
async function writeProcurementAuditLog({ tenantId, action, entityType, entityId, details, performedBy }) {
  /* addDoc to procument_audit_log */
}
export const getProcurementAuditLog = async (tenantId, entityType = null, entityId = null) => {
  /* query by tenantId + optional filters */
}
```

### 5.6 Validation (`src/lib/procurementValidation.js`)

```js
export const PO_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"];
export const GR_STATUSES = ["DRAFT", "COMPLETED", "CANCELLED"];
export const SUPPLIER_STATUSES = ["ACTIVE", "INACTIVE", "DELETED"];
export const PAYMENT_TERMS = ["NET15", "NET30", "NET60", "CASH", "COD"];
export const CURRENCIES = ["SAR", "USD", "EUR", "AED", "EGP"];

// Allowed PO transitions (used internally by state machine functions)
export const PO_TRANSITIONS = {
  DRAFT:            ["SUBMITTED", "CANCELLED"],
  SUBMITTED:        ["APPROVED", "CANCELLED"],
  APPROVED:         ["ORDERED", "CANCELLED"],
  ORDERED:          ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "CLOSED"],
  RECEIVED:         ["CLOSED"],
  CLOSED:           [],
  CANCELLED:        [],
};

export function validatePOTransition(currentStatus, newStatus) { /* check allowed */ }
export function validatePOItems(items) { /* at least 1 item, all qty > 0, unitCost >= 0 */ }
export function validateSupplierName(name) { /* bilingual required */ }
export function validateReceiptQuantity(received, pending) { /* received <= pending */ }
export function validatePONumber(poNumber) { /* format: PO-YYYY-XXXXX */ }
export function validateProcurementData(type, data) { /* returns { valid, errors } */ }
```

---

## 6. API Design

### 6.1 `POST /api/admin/procurement-approve`

**Purpose:** Server-side PO approval with explicit admin token verification. Ensures only authenticated admins can approve POs (defense in depth).

**Headers:** `Authorization: Bearer <Firebase ID Token>`

**Input:**
```json
{
  "poId": "string",
  "tenantId": "string"
}
```

**Process:**
1. Verify Firebase ID token → extract `adminUid`
2. Verify `admin: true` custom claim
3. Call `approvePO(poId, adminUid)`
4. Return `{ success: true, status: "APPROVED" }`

### 6.2 `POST /api/admin/procurement-receive`

**Purpose:** Complete a goods receipt and create all inventory movements in a single atomic server-side operation. This is the critical integration point — movement creation must be transactional.

**Input:**
```json
{
  "receiptId": "string",
  "tenantId": "string"
}
```

**Process:**
1. Verify Firebase ID token
2. Get goods_receipt + items (must be DRAFT)
3. **Firestore batch write:**
   - For each item with `inventoryItemId`:
     - Create `inventory_movements` doc (PURCHASE type)
     - Update `inventory_items.currentStock` and `averageCost`
     - Write `inventory_audit_log` entry
     - Store `movementId` on the goods_receipt_item
   - Update each `purchase_order_item.quantityReceived`
   - Update `goods_receipts` status → COMPLETED
   - Write `procurement_audit_log` entries
4. If any step fails, entire batch fails (atomic)
5. Return `{ success: true, receiptId, movementsCreated: count, poStatus }`

---

## 7. UI Design

### 7.1 Page Structure

**Single page: `/procurement`** — `src/pages/Procurement.jsx`

Layout (matching Inventory and existing page patterns):
```
PageContainer (min-height:100vh, bg:#04091a, margin-left responsive)
├── Background glows
├── TopBar (gradient header with logo + title)
│   └── Action buttons: "New PO", "New Supplier" (context-sensitive)
├── ContentWrapper
│   ├── Stats Row (Active POs, Pending Approval, Pending Receipt, Suppliers)
│   ├── Tabs (Purchase Orders | Suppliers | Goods Receipts)
│   └── Tab Content:
│       ├── Purchase Orders Tab:
│       │   ├── Filter bar: status dropdown, supplier search, date range
│       │   ├── Table: PO#, Supplier, Status (color-coded), Items, Total, Order Date, Expected, Actions
│       │   ├── PO Detail / Create-Edit Dialog (multi-step):
│       │   │   ├── Step 1: Header — Supplier select, expected date, terms, notes
│       │   │   ├── Step 2: Items — line items table with add/remove rows
│       │   │   │   ├── Item selector (search inventory items OR type ad-hoc name)
│       │   │   │   ├── Quantity, Unit Cost, Unit (prefilled from inventory item)
│       │   │   │   └── Auto-calculated totals
│       │   │   └── Step 3: Review — subtotal, tax, shipping, total
│       │   └── PO Detail View (read-only after SUBMITTED):
│       │       ├── Status timeline (DRAFT → SUBMITTED → APPROVED → ...)
│       │       ├── PO header info
│       │       ├── Items table with receipt progress bars
│       │       ├── Related goods receipts table
│       │       └── Action buttons (Submit, Approve, Mark Ordered, Receive, Close, Cancel)
│       │
│       ├── Suppliers Tab:
│       │   ├── Table: Name (EN/AR), Contact, Phone, Email, Payment Terms, Status, Actions
│       │   ├── Create/Edit Dialog (BilingualInput for name, text fields for rest)
│       │   └── Quick action: "Create PO" from supplier detail
│       │
│       └── Goods Receipts Tab:
│           ├── Table: Receipt#, PO#, Supplier, Date, Items, Status, Actions
│           ├── "New Receipt" dialog:
│           │   ├── Select PO (only ORDERED / PARTIALLY_RECEIVED)
│           │   ├── For each PO item: display quantityOrdered, quantityReceived, quantityPending
│           │   ├── Input: quantityReceived (default = quantityPending)
│           │   ├── Input: batchNumber, expiryDate (if item is tracked)
│           │   └── Notes
│           └── "Complete Receipt" action → triggers movement creation
```

### 7.2 Routes

```jsx
// App.jsx additions:
import Procurement from "./pages/Procurement";

<Route path="/procurement" element={<Procurement />} />
```

```jsx
// Sidebar.jsx NAV_ITEMS additions:
{
  section: "Management",
  items: [
    // ... existing items (Tenants, Doctors, Licenses, Updates, Inventory) ...
    { to: "/procurement", icon: "📋", label: "Procurement" },
  ],
}
```

### 7.3 Status Color Coding

| Status | Color | Context |
|---|---|---|
| DRAFT | Gray (#64748b) | PO not yet submitted |
| SUBMITTED | Blue (#60a5fa) | PO pending approval |
| APPROVED | Teal (#2dd4bf) | PO approved, not yet ordered |
| ORDERED | Indigo (#818cf8) | PO sent to supplier |
| PARTIALLY_RECEIVED | Amber (#f59e0b) | Some items received |
| RECEIVED | Green (#34d399) | All items received |
| CLOSED | White (#eaf2ff) | PO complete |
| CANCELLED | Red (#f87171) | PO cancelled |
| COMPLETED (GR) | Green (#34d399) | Goods receipt finalized |

### 7.4 Stats Row

```
┌────────────────┬────────────────┬─────────────────┬────────────────┐
│ Active POs     │ Pending        │ Pending Receipt │ Active         │
│ (not Closed/   │ Approval       │ (ORDERED PO)    │ Suppliers      │
│  Cancelled)    │                │                  │                │
│      18        │      3         │        7         │      24        │
└────────────────┴────────────────┴─────────────────┴────────────────┘
```

### 7.5 Receipt Progress Bars

In the PO items table, each line item shows a progress bar (matching MUI LinearProgress style):
```
┌──────────┬──────┬────────┬──────────┬──────────────────────┬─────────┐
│ Item     │ SKU  │ Qty    │ Received │ Progress             │ Cost    │
├──────────┼──────┼────────┼──────────┼──────────────────────┼─────────┤
│ Paracet  │ P-01 │ 500    │ 200      │ ████████░░░░ 40%     │ 250.00  │
│ Bandages │ B-03 │ 1000   │ 1000     │ ████████████ 100%    │ 800.00  │
└──────────┴──────┴────────┴──────────┴──────────────────────┴─────────┘
```

---

## 8. Security Design

### 8.1 Firestore Rules

```
match /suppliers/{supplierId} {
  allow read, write: if isAnyAdmin();
}

match /purchase_orders/{poId} {
  allow read, write: if isAnyAdmin();
}

match /purchase_order_items/{itemId} {
  allow read, write: if isAnyAdmin();
}

match /goods_receipts/{receiptId} {
  allow read: if isAnyAdmin();
  allow create: if isAnyAdmin();
  allow update: if isAnyAdmin();    // Status changes
  allow delete: if false;           // Immutable after creation
}

match /goods_receipt_items/{itemId} {
  allow read: if isAnyAdmin();
  allow create: if isAnyAdmin();
  allow update, delete: if false;   // Written once at creation
}

match /procurement_audit_log/{logId} {
  allow read: if isAnyAdmin();
  allow create: if isAnyAdmin();
  allow update, delete: if false;   // Append-only
}

match /procurement_meta/{tenantId} {
  allow read, write: if isAnyAdmin();
}
```

### 8.2 Tenant Isolation

Same model as Inventory: every document carries `tenantId`, all queries filter by it. Isolation enforced at the service layer.

### 8.3 Permission Enforcement

- **Admin-only:** All procurement operations require `admin: true` custom claim
- **API routes:** Serverless functions verify Firebase ID token before processing
- **No public access:** Procurement is never exposed to community app

### 8.4 State Machine Enforcement

PO status transitions are enforced in the service layer — not in the UI. The UI calls named functions (`submitPO()`, `approvePO()`, etc.), each of which validates the transition against `PO_TRANSITIONS` in `procurementValidation.js`. This prevents:
- Approving a draft PO without submission
- Editing a submitted PO
- Receiving against an unapproved PO
- Cancelling a received PO without reversing movements

### 8.5 Data Integrity

| Constraint | Enforcement |
|---|---|
| PO number unique per tenant | Counter stored in `procurement_meta/{tenantId}` |
| No over-receipt | `quantityReceived <= quantityPending` validated in service |
| Atomic GR → movement | Movement creation inside batch write — failure rolls back |
| No GR deletion after movements | Service blocks `cancelGoodsReceipt` if `movementsCreated === true` |
| Supplier no-delete if referenced | Check POs before soft-deleting supplier |
| PO status transition valid | Checked against `PO_TRANSITIONS` mapping |

---

## 9. Audit Strategy

### 9.1 What Gets Audited

| Action | Audit Entry |
|---|---|
| Supplier created | `SUPPLIER_CREATED` — snapshot of all fields |
| Supplier updated | `SUPPLIER_UPDATED` — before/after diff |
| Supplier deleted (soft) | `SUPPLIER_UPDATED` — status→DELETED |
| PO created | `PO_CREATED` — items count, total |
| PO submitted | `PO_SUBMITTED` — submittedBy |
| PO approved | `PO_APPROVED` — approvedBy |
| PO ordered | `PO_ORDERED` — orderedBy, orderDate |
| PO received (auto) | `PO_RECEIVED` — via GR |
| PO closed | `PO_CLOSED` — closedBy, force-close flag |
| PO cancelled | `PO_CANCELLED` — cancelledBy, reason |
| GR created | `GR_CREATED` — items count, PO reference |
| GR completed | `GR_COMPLETED` — movementsCreated count |
| Movement created (per item) | `MOVEMENT_CREATED` — itemId, qty, unitCost, movementId |
| GR cancelled | `GR_CANCELLED` — cancelledBy, reason |

### 9.2 Storage

All audit entries go to `procurement_audit_log` (append-only collection). These are separate from `inventory_audit_log` — inventory movements already log their own audit trail. The procurement audit links to movement audit via `movementId`.

### 9.3 Access

Audit log is queryable via `getProcurementAuditLog(tenantId, entityType, entityId)` — used in the UI detail views to show a history timeline.

---

## 10. Firestore Composite Indexes

| Collection | Fields | Purpose |
|---|---|---|
| `purchase_orders` | `tenantId` ASC, `createdAt` DESC | Main listing |
| `purchase_orders` | `tenantId` ASC, `status` ASC, `createdAt` DESC | Filter by status |
| `purchase_orders` | `tenantId` ASC, `supplierId` ASC, `createdAt` DESC | Filter by supplier |
| `purchase_order_items` | `poId` ASC, `lineNumber` ASC | Items for a PO |
| `purchase_order_items` | `tenantId` ASC, `inventoryItemId` ASC, `createdAt` DESC | Items referencing an inventory item |
| `goods_receipts` | `tenantId` ASC, `createdAt` DESC | Main listing |
| `goods_receipts` | `poId` ASC, `createdAt` ASC | Receipts for a PO |
| `goods_receipt_items` | `receiptId` ASC, `lineNumber` ASC | Items for a receipt |
| `goods_receipt_items` | `poItemId` ASC, `createdAt` ASC | Receipt lines for a PO item |
| `suppliers` | `tenantId` ASC, `name.en` ASC | Supplier listing (sorted by name) |
| `procurement_audit_log` | `tenantId` ASC, `createdAt` DESC | Audit listing |
| `procurement_audit_log` | `tenantId` ASC, `entityType` ASC, `entityId` ASC | Filter by entity |

---

## 11. Implementation Order

| Step | Description | Depends On |
|---|---|---|
| 1 | Create `procurementValidation.js` | Nothing |
| 2 | Add Firestore indexes | Nothing |
| 3 | Update `firestore.rules` with procurement rules | Nothing |
| 4 | Add Supplier functions to `firestoreService.js` | Step 1 |
| 5 | Add PO functions (create, get, state machine) to `firestoreService.js` | Step 4, Inventory service |
| 6 | Add Goods Receipt functions to `firestoreService.js` | Step 5, Inventory `createMovement` |
| 7 | Add Audit Log functions to `firestoreService.js` | Nothing |
| 8 | Create `api/admin/procurement-approve.js` | Step 5 |
| 9 | Create `api/admin/procurement-receive.js` | Step 6 |
| 10 | Create `src/pages/Procurement.jsx` (tabbed) | Steps 4-7 |
| 11 | Update `Sidebar.jsx` NAV_ITEMS | Step 10 |
| 12 | Update `App.jsx` route | Step 10 |
| 13 | Verify build + lint | All |

---

## 12. Summary of New/Modified Files

| File | Action | Lines (est.) |
|---|---|---|
| `src/services/firestoreService.js` | EXTEND | +280 lines (after Inventory section) |
| `src/lib/procurementValidation.js` | CREATE | +100 lines |
| `src/pages/Procurement.jsx` | CREATE | +900 lines |
| `api/admin/procurement-approve.js` | CREATE | +80 lines |
| `api/admin/procurement-receive.js` | CREATE | +120 lines |
| `src/components/Sidebar.jsx` | EXTEND | +1 nav item |
| `src/App.jsx` | EXTEND | +1 import + 1 route |
| `firestore.rules` | EXTEND | +40 lines (7 collection rules) |
| `docs/INVENTORY_ARCHITECTURE.md` | — | Reference (no change needed) |
| `docs/ARCHITECTURE.md` | EXTEND | +Procurement section |
| `PROJECT_CONTEXT.md` | EXTEND | +Procurement sections |
| `PROJECT_MAP.md` | EXTEND | +Procurement entries |

---

## 13. Dependency on Inventory (Phase 18)

Procurement requires the following Inventory service functions to be implemented first:

| Inventory Function | Used By Procurement |
|---|---|
| `getAllItems(tenantId)` | PO item selector (search inventory items) |
| `getItemById(itemId)` | PO item detail, unit/name snapshots |
| `createMovement(data)` | Goods receipt completion (GR→Movement→Stock) |
| `inventory_movements` collection | Movement reference storage |
| `inventory_items.currentStock` | NEVER written by procurement (read-only) |
| `inventory_items.averageCost` | NEVER written by procurement (updated by createMovement) |

---

*End of design document. Ready for review before implementation.*
