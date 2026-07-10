import { collection, getDocs, doc, addDoc, updateDoc, query, orderBy, serverTimestamp, where, limit, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./core";

// ###########################################################################
// INVENTORY MODULE
// ###########################################################################

// ─── Internal: Audit Log ───────────────────────────────────────────────────

async function writeInventoryAuditLog({ tenantId, action, entityType, entityId, details, performedBy }) {
  try {
    await addDoc(collection(db, COLLECTIONS.INVENTORY_AUDIT_LOG), {
      tenantId, action, entityType, entityId,
      details: details || {},
      performedBy,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Inventory audit log write failed (non-fatal):", e);
  }
}

export const getInventoryAuditLog = async (tenantId, entityType = null, entityId = null) => {
  const constraints = [where("tenantId", "==", tenantId), orderBy("createdAt", "desc")];
  if (entityType) constraints.push(where("entityType", "==", entityType));
  if (entityId) constraints.push(where("entityId", "==", entityId));
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.INVENTORY_AUDIT_LOG), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── INVENTORY: Categories ─────────────────────────────────────────────────

export const createCategory = async (data) => {
  const ref = await addDoc(collection(db, COLLECTIONS.INVENTORY_CATEGORIES), {
    tenantId: data.tenantId,
    name: data.name,
    description: data.description || "",
    parentId: data.parentId || null,
    status: "ACTIVE",
    sortOrder: data.sortOrder || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeInventoryAuditLog({
    tenantId: data.tenantId, action: "CATEGORY_CREATED", entityType: "category",
    entityId: ref.id, details: { name: data.name }, performedBy: data.createdBy,
  });
  return ref.id;
};

export const getAllCategories = async (tenantId) => {
  const q = query(
    collection(db, COLLECTIONS.INVENTORY_CATEGORIES),
    where("tenantId", "==", tenantId),
    orderBy("sortOrder", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateCategory = async (categoryId, updates) => {
  await updateDoc(doc(db, COLLECTIONS.INVENTORY_CATEGORIES, categoryId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteCategory = async (categoryId, tenantId) => {
  const activeItems = await getDocs(query(
    collection(db, COLLECTIONS.INVENTORY_ITEMS),
    where("tenantId", "==", tenantId),
    where("categoryId", "==", categoryId),
    where("status", "==", "ACTIVE")
  ));
  if (!activeItems.empty) throw new Error("Cannot delete category with active items");
  await updateDoc(doc(db, COLLECTIONS.INVENTORY_CATEGORIES, categoryId), {
    status: "DELETED",
    updatedAt: serverTimestamp(),
  });
};

// ─── INVENTORY: Items ──────────────────────────────────────────────────────

export const createItem = async (data) => {
  const existing = await getDocs(query(
    collection(db, COLLECTIONS.INVENTORY_ITEMS),
    where("tenantId", "==", data.tenantId),
    where("SKU", "==", data.SKU)
  ));
  if (!existing.empty) throw new Error(`SKU "${data.SKU}" already exists for this tenant`);

  if (data.itemCode) {
    const existingCode = await getDocs(query(
      collection(db, COLLECTIONS.INVENTORY_ITEMS),
      where("tenantId", "==", data.tenantId),
      where("itemCode", "==", data.itemCode)
    ));
    if (!existingCode.empty) throw new Error(`Item code "${data.itemCode}" already exists for this tenant`);
  }

  const ref = await addDoc(collection(db, COLLECTIONS.INVENTORY_ITEMS), {
    tenantId: data.tenantId,
    categoryId: data.categoryId,
    SKU: data.SKU,
    itemCode: data.itemCode || "",
    name: data.name,
    unit: data.unit,
    currentStock: 0,
    reorderLevel: data.reorderLevel || 0,
    averageCost: 0,
    sellingPrice: data.sellingPrice || 0,
    batchTracked: data.batchTracked || false,
    expiryTracked: data.expiryTracked || false,
    imageUrl: data.imageUrl || "",
    status: "ACTIVE",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await writeInventoryAuditLog({
    tenantId: data.tenantId, action: "ITEM_CREATED", entityType: "item",
    entityId: ref.id, details: { SKU: data.SKU, name: data.name }, performedBy: data.createdBy,
  });

  return ref.id;
};

export const getAllItems = async (tenantId, filters = {}) => {
  const constraints = [where("tenantId", "==", tenantId)];
  if (filters.status && filters.status !== "ALL") constraints.push(where("status", "==", filters.status));
  else constraints.push(where("status", "!=", "DELETED"));
  if (filters.categoryId) constraints.push(where("categoryId", "==", filters.categoryId));
  constraints.push(orderBy("createdAt", "desc"));
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.INVENTORY_ITEMS), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getItemById = async (itemId) => {
  const snap = await getDoc(doc(db, COLLECTIONS.INVENTORY_ITEMS, itemId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const updateItem = async (itemId, updates, auditData = null) => {
  await updateDoc(doc(db, COLLECTIONS.INVENTORY_ITEMS, itemId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
  if (auditData) {
    await writeInventoryAuditLog({
      tenantId: auditData.tenantId, action: "ITEM_STATUS_CHANGED", entityType: "item",
      entityId: itemId, details: { updates }, performedBy: auditData.performedBy,
    });
  }
};

export const deleteItem = async (itemId, auditData = null) => {
  await updateDoc(doc(db, COLLECTIONS.INVENTORY_ITEMS, itemId), {
    status: "DELETED",
    updatedAt: serverTimestamp(),
  });
  if (auditData) {
    await writeInventoryAuditLog({
      tenantId: auditData.tenantId, action: "ITEM_STATUS_CHANGED", entityType: "item",
      entityId: itemId, details: { status: "DELETED" }, performedBy: auditData.performedBy,
    });
  }
};

export const getLowStockItems = async (tenantId, _threshold = 0) => {
  const q = query(
    collection(db, COLLECTIONS.INVENTORY_ITEMS),
    where("tenantId", "==", tenantId),
    where("status", "==", "ACTIVE")
  );
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return all.filter((item) => item.currentStock <= item.reorderLevel);
};

// ─── INVENTORY: Movements ──────────────────────────────────────────────────

export const createMovement = async (data) => {
  const itemSnap = await getDoc(doc(db, COLLECTIONS.INVENTORY_ITEMS, data.itemId));
  if (!itemSnap.exists()) throw new Error("Item not found");
  const item = itemSnap.data();

  const stockBefore = item.currentStock || 0;
  const qty = Number(data.quantity);
  const stockAfter = stockBefore + (data.type === "PURCHASE" || data.type === "RETURN" || data.type === "OPENING_BALANCE" ? qty : -qty);

  let newAvgCost = item.averageCost || 0;
  if (data.type === "PURCHASE" && data.unitCost) {
    const unitCost = Number(data.unitCost);
    if (stockBefore + qty > 0) {
      newAvgCost = (stockBefore * newAvgCost + qty * unitCost) / (stockBefore + qty);
    } else {
      newAvgCost = unitCost;
    }
  }

  const batch = writeBatch(db);

  const movementRef = doc(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS));
  batch.set(movementRef, {
    tenantId: data.tenantId,
    itemId: data.itemId,
    type: data.type,
    quantity: data.type === "PURCHASE" || data.type === "RETURN" || data.type === "OPENING_BALANCE" ? qty : -qty,
    unitCost: data.unitCost || 0,
    totalCost: Math.abs(qty * (data.unitCost || 0)),
    stockBefore,
    stockAfter,
    referenceType: data.referenceType || null,
    referenceId: data.referenceId || null,
    notes: data.notes || "",
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
  });

  const itemRef = doc(db, COLLECTIONS.INVENTORY_ITEMS, data.itemId);
  batch.update(itemRef, { currentStock: stockAfter, averageCost: newAvgCost, updatedAt: serverTimestamp() });

  await batch.commit();

  await writeInventoryAuditLog({
    tenantId: data.tenantId, action: "MOVEMENT", entityType: "movement",
    entityId: movementRef.id,
    details: { itemId: data.itemId, type: data.type, qty, stockBefore, stockAfter, newAvgCost },
    performedBy: data.createdBy,
  });

  return movementRef.id;
};

export const getMovementsByItem = async (itemId, tenantId) => {
  const q = query(
    collection(db, COLLECTIONS.INVENTORY_MOVEMENTS),
    where("tenantId", "==", tenantId),
    where("itemId", "==", itemId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getMovementsByType = async (tenantId, type) => {
  const q = query(
    collection(db, COLLECTIONS.INVENTORY_MOVEMENTS),
    where("tenantId", "==", tenantId),
    where("type", "==", type),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAllMovements = async (tenantId, opts = {}) => {
  const constraints = [where("tenantId", "==", tenantId), orderBy("createdAt", "desc")];
  if (opts.limit) constraints.push(limit(opts.limit));
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── INVENTORY: Adjustments ────────────────────────────────────────────────

export const createAdjustment = async (data) => {
  const ref = await addDoc(collection(db, COLLECTIONS.INVENTORY_ADJUSTMENTS), {
    tenantId: data.tenantId,
    itemId: data.itemId,
    reason: data.reason,
    expectedQty: data.expectedQty,
    actualQty: data.actualQty,
    difference: data.actualQty - data.expectedQty,
    notes: data.notes || "",
    status: "PENDING",
    approvedBy: null,
    approvedAt: null,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeInventoryAuditLog({
    tenantId: data.tenantId, action: "ADJUSTMENT_CREATED", entityType: "adjustment",
    entityId: ref.id,
    details: { itemId: data.itemId, reason: data.reason, expectedQty: data.expectedQty, actualQty: data.actualQty },
    performedBy: data.createdBy,
  });
  return ref.id;
};

export const approveAdjustment = async (adjustmentId, adminUid) => {
  const snap = await getDoc(doc(db, COLLECTIONS.INVENTORY_ADJUSTMENTS, adjustmentId));
  if (!snap.exists()) throw new Error("Adjustment not found");
  const adj = snap.data();
  if (adj.status !== "PENDING") throw new Error("Adjustment is not PENDING");

  const movementId = await createMovement({
    tenantId: adj.tenantId,
    itemId: adj.itemId,
    type: "ADJUSTMENT",
    quantity: Math.abs(adj.difference),
    unitCost: 0,
    referenceType: "adjustment",
    referenceId: adjustmentId,
    notes: adj.notes || `Adjustment: ${adj.reason}`,
    createdBy: adminUid,
  });

  await updateDoc(doc(db, COLLECTIONS.INVENTORY_ADJUSTMENTS, adjustmentId), {
    status: "APPROVED",
    approvedBy: adminUid,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await writeInventoryAuditLog({
    tenantId: adj.tenantId, action: "ADJUSTMENT_APPROVED", entityType: "adjustment",
    entityId: adjustmentId,
    details: { movementId, difference: adj.difference },
    performedBy: adminUid,
  });
};

export const rejectAdjustment = async (adjustmentId) => {
  await updateDoc(doc(db, COLLECTIONS.INVENTORY_ADJUSTMENTS, adjustmentId), {
    status: "REJECTED",
    updatedAt: serverTimestamp(),
  });
};

export const getPendingAdjustments = async (tenantId) => {
  const q = query(
    collection(db, COLLECTIONS.INVENTORY_ADJUSTMENTS),
    where("tenantId", "==", tenantId),
    where("status", "==", "PENDING"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAllAdjustments = async (tenantId) => {
  const q = query(
    collection(db, COLLECTIONS.INVENTORY_ADJUSTMENTS),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── INVENTORY: Stock Counts ───────────────────────────────────────────────

export const createStockCount = async (data) => {
  const ref = await addDoc(collection(db, COLLECTIONS.INVENTORY_STOCK_COUNTS), {
    tenantId: data.tenantId,
    countDate: data.countDate,
    status: "SCHEDULED",
    items: [],
    totalDiscrepancy: 0,
    reconciledAt: null,
    reconciledBy: null,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeInventoryAuditLog({
    tenantId: data.tenantId, action: "STOCK_COUNT_CREATED", entityType: "stock_count",
    entityId: ref.id, details: { countDate: data.countDate }, performedBy: data.createdBy,
  });
  return ref.id;
};

export const updateStockCountItems = async (countId, countedItems) => {
  const totalDiscrepancy = countedItems.reduce((sum, item) => sum + Math.abs(item.difference || 0), 0);
  await updateDoc(doc(db, COLLECTIONS.INVENTORY_STOCK_COUNTS, countId), {
    items: countedItems,
    totalDiscrepancy,
    updatedAt: serverTimestamp(),
  });
};

export const completeStockCount = async (countId) => {
  await updateDoc(doc(db, COLLECTIONS.INVENTORY_STOCK_COUNTS, countId), {
    status: "COMPLETED",
    updatedAt: serverTimestamp(),
  });
};

export const reconcileStockCount = async (countId, adminUid) => {
  const snap = await getDoc(doc(db, COLLECTIONS.INVENTORY_STOCK_COUNTS, countId));
  if (!snap.exists()) throw new Error("Stock count not found");
  const count = snap.data();

  for (const item of count.items) {
    if (item.difference !== 0) {
      await createMovement({
        tenantId: count.tenantId,
        itemId: item.itemId,
        type: "ADJUSTMENT",
        quantity: Math.abs(item.difference),
        unitCost: 0,
        referenceType: "stock_count",
        referenceId: countId,
        notes: item.notes || `Stock count reconciliation`,
        createdBy: adminUid,
      });
    }
  }

  await updateDoc(doc(db, COLLECTIONS.INVENTORY_STOCK_COUNTS, countId), {
    status: "RECONCILED",
    reconciledAt: serverTimestamp(),
    reconciledBy: adminUid,
    updatedAt: serverTimestamp(),
  });

  await writeInventoryAuditLog({
    tenantId: count.tenantId, action: "STOCK_COUNT_RECONCILED", entityType: "stock_count",
    entityId: countId, details: { totalDiscrepancy: count.totalDiscrepancy }, performedBy: adminUid,
  });
};

export const getAllStockCounts = async (tenantId) => {
  const q = query(
    collection(db, COLLECTIONS.INVENTORY_STOCK_COUNTS),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};
