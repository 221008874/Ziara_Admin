import { collection, getDocs, doc, setDoc, addDoc, updateDoc, query, orderBy, serverTimestamp, where, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./core";
import { createMovement } from "./inventory";

// ###########################################################################
// PROCUREMENT MODULE
// ###########################################################################

// ─── Internal: Audit Log ───────────────────────────────────────────────────

async function writeProcurementAuditLog({ tenantId, action, entityType, entityId, details, performedBy }) {
  try {
    await addDoc(collection(db, COLLECTIONS.PROCUREMENT_AUDIT_LOG), {
      tenantId, action, entityType, entityId,
      details: details || {},
      performedBy,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Procurement audit log write failed (non-fatal):", e);
  }
}

export const getProcurementAuditLog = async (tenantId, entityType = null, entityId = null) => {
  const constraints = [where("tenantId", "==", tenantId), orderBy("createdAt", "desc")];
  if (entityType) constraints.push(where("entityType", "==", entityType));
  if (entityId) constraints.push(where("entityId", "==", entityId));
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.PROCUREMENT_AUDIT_LOG), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── PROCUREMENT: PO Number / Receipt Number Generation ────────────────────

async function getNextCounter(tenantId, prefix) {
  const metaRef = doc(db, COLLECTIONS.PROCUREMENT_META, tenantId);
  const metaSnap = await getDoc(metaRef);
  const year = new Date().getFullYear();
  const key = prefix === "PO" ? "lastPOCounter" : "lastGRCounter";
  const current = metaSnap.exists() ? (metaSnap.data()[key] || 0) : 0;
  const next = current + 1;
  await setDoc(metaRef, { [key]: next }, { merge: true });
  return `${prefix}-${year}-${String(next).padStart(5, "0")}`;
}

// ─── PROCUREMENT: Suppliers ────────────────────────────────────────────────

export const createSupplier = async (data) => {
  const ref = await addDoc(collection(db, COLLECTIONS.SUPPLIERS), {
    tenantId: data.tenantId,
    name: data.name,
    contactPerson: data.contactPerson || "",
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    taxId: data.taxId || "",
    paymentTerms: data.paymentTerms || "NET30",
    status: "ACTIVE",
    notes: data.notes || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeProcurementAuditLog({
    tenantId: data.tenantId, action: "SUPPLIER_CREATED", entityType: "supplier",
    entityId: ref.id, details: { name: data.name }, performedBy: data.createdBy,
  });
  return ref.id;
};

export const getAllSuppliers = async (tenantId) => {
  const q = query(
    collection(db, COLLECTIONS.SUPPLIERS),
    where("tenantId", "==", tenantId),
    orderBy("name")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getSupplierById = async (supplierId) => {
  const snap = await getDoc(doc(db, COLLECTIONS.SUPPLIERS, supplierId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const updateSupplier = async (supplierId, updates, auditData = null) => {
  await updateDoc(doc(db, COLLECTIONS.SUPPLIERS, supplierId), { ...updates, updatedAt: serverTimestamp() });
  if (auditData) {
    await writeProcurementAuditLog({
      tenantId: auditData.tenantId, action: "SUPPLIER_UPDATED", entityType: "supplier",
      entityId: supplierId, details: { updates }, performedBy: auditData.performedBy,
    });
  }
};

export const deleteSupplier = async (supplierId, tenantId) => {
  const activePOs = await getDocs(query(
    collection(db, COLLECTIONS.PURCHASE_ORDERS),
    where("tenantId", "==", tenantId),
    where("supplierId", "==", supplierId),
    where("status", "in", ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"])
  ));
  if (!activePOs.empty) throw new Error("Cannot delete supplier with active purchase orders");
  await updateDoc(doc(db, COLLECTIONS.SUPPLIERS, supplierId), {
    status: "DELETED",
    updatedAt: serverTimestamp(),
  });
};

// ─── PROCUREMENT: Purchase Orders ──────────────────────────────────────────

export const createPO = async (data) => {
  const poNumber = await getNextCounter(data.tenantId, "PO");

  const poRef = await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDERS), {
    tenantId: data.tenantId,
    poNumber,
    supplierId: data.supplierId,
    supplierName: data.supplierName || "",
    status: "DRAFT",
    orderDate: data.orderDate || "",
    expectedDate: data.expectedDate || "",
    receivedDate: null,
    subtotal: 0,
    taxAmount: data.taxAmount || 0,
    shippingCost: data.shippingCost || 0,
    totalAmount: 0,
    currency: data.currency || "SAR",
    notes: data.notes || "",
    terms: data.terms || "",
    submittedBy: null, submittedAt: null,
    approvedBy: null, approvedAt: null,
    orderedBy: null, orderedAt: null,
    closedBy: null, closedAt: null,
    cancelledBy: null, cancelledAt: null, cancellationReason: "",
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  let lineNumber = 1;
  let subtotal = 0;
  for (const item of (data.items || [])) {
    const totalCost = (item.quantityOrdered || 0) * (item.unitCost || 0);
    subtotal += totalCost;
    await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS), {
      tenantId: data.tenantId,
      poId: poRef.id,
      lineNumber: lineNumber++,
      inventoryItemId: item.inventoryItemId || null,
      itemName: item.itemName?.en || item.itemName || "",
      itemNameAr: item.itemName?.ar || "",
      SKU: item.SKU || "",
      unit: item.unit || "piece",
      quantityOrdered: item.quantityOrdered || 0,
      quantityReceived: 0,
      quantityPending: item.quantityOrdered || 0,
      unitCost: item.unitCost || 0,
      totalCost,
      notes: item.notes || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const totalAmount = subtotal + (data.taxAmount || 0) + (data.shippingCost || 0);
  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poRef.id), {
    subtotal, totalAmount, updatedAt: serverTimestamp(),
  });

  await writeProcurementAuditLog({
    tenantId: data.tenantId, action: "PO_CREATED", entityType: "purchase_order",
    entityId: poRef.id, details: { poNumber, itemsCount: (data.items || []).length, totalAmount },
    performedBy: data.createdBy,
  });

  return { id: poRef.id, poNumber };
};

export const getPOs = async (tenantId, filters = {}) => {
  const constraints = [where("tenantId", "==", tenantId)];
  if (filters.status) constraints.push(where("status", "==", filters.status));
  if (filters.supplierId) constraints.push(where("supplierId", "==", filters.supplierId));
  constraints.push(orderBy("createdAt", "desc"));
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.PURCHASE_ORDERS), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getPOById = async (poId) => {
  const snap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!snap.exists()) return null;
  const po = { id: snap.id, ...snap.data() };
  const itemsSnap = await getDocs(query(
    collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
    where("poId", "==", poId),
    orderBy("lineNumber", "asc")
  ));
  po.items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return po;
};

export const updatePO = async (poId, updates) => {
  const snap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!snap.exists()) throw new Error("PO not found");
  if (snap.data().status !== "DRAFT") throw new Error("Can only edit PO in DRAFT status");
  const { status, ...safeUpdates } = updates;
  if (status) throw new Error("Status cannot be changed via updatePO. Use submitPO/approvePO/etc.");
  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), { ...safeUpdates, updatedAt: serverTimestamp() });
};

export const submitPO = async (poId, adminUid) => {
  const snap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!snap.exists()) throw new Error("PO not found");
  const po = snap.data();
  if (po.status !== "DRAFT") throw new Error("Only DRAFT PO can be submitted");

  const itemsSnap = await getDocs(query(
    collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
    where("poId", "==", poId)
  ));
  if (itemsSnap.empty) throw new Error("PO must have at least one item");

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: "SUBMITTED", submittedBy: adminUid, submittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await writeProcurementAuditLog({
    tenantId: po.tenantId, action: "PO_SUBMITTED", entityType: "purchase_order",
    entityId: poId, details: { poNumber: po.poNumber }, performedBy: adminUid,
  });
};

export const approvePO = async (poId, adminUid) => {
  const snap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!snap.exists()) throw new Error("PO not found");
  const po = snap.data();
  if (po.status !== "SUBMITTED") throw new Error("Only SUBMITTED PO can be approved");

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: "APPROVED", approvedBy: adminUid, approvedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await writeProcurementAuditLog({
    tenantId: po.tenantId, action: "PO_APPROVED", entityType: "purchase_order",
    entityId: poId, details: {}, performedBy: adminUid,
  });
};

export const markOrdered = async (poId, adminUid, orderDate) => {
  const snap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!snap.exists()) throw new Error("PO not found");
  const po = snap.data();
  if (po.status !== "APPROVED") throw new Error("Only APPROVED PO can be marked ordered");

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: "ORDERED", orderedBy: adminUid, orderedAt: serverTimestamp(),
    orderDate: orderDate || new Date().toISOString().split("T")[0], updatedAt: serverTimestamp(),
  });
  await writeProcurementAuditLog({
    tenantId: po.tenantId, action: "PO_ORDERED", entityType: "purchase_order",
    entityId: poId, details: { orderDate }, performedBy: adminUid,
  });
};

export const closePO = async (poId, adminUid) => {
  const snap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!snap.exists()) throw new Error("PO not found");
  const po = snap.data();
  if (po.status !== "RECEIVED" && po.status !== "PARTIALLY_RECEIVED") {
    throw new Error("Only RECEIVED or PARTIALLY_RECEIVED PO can be closed");
  }

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: "CLOSED", closedBy: adminUid, closedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await writeProcurementAuditLog({
    tenantId: po.tenantId, action: "PO_CLOSED", entityType: "purchase_order",
    entityId: poId, details: { previousStatus: po.status }, performedBy: adminUid,
  });
};

export const cancelPO = async (poId, reason, adminUid) => {
  const snap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!snap.exists()) throw new Error("PO not found");
  const po = snap.data();
  if (!["DRAFT", "SUBMITTED", "APPROVED", "ORDERED"].includes(po.status)) {
    throw new Error("Cannot cancel PO in current status");
  }

  const grSnap = await getDocs(query(
    collection(db, COLLECTIONS.GOODS_RECEIPTS),
    where("poId", "==", poId),
    where("movementsCreated", "==", true)
  ));
  if (!grSnap.empty) throw new Error("Cannot cancel PO with completed goods receipts");

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: "CANCELLED", cancelledBy: adminUid, cancelledAt: serverTimestamp(),
    cancellationReason: reason || "", updatedAt: serverTimestamp(),
  });
  await writeProcurementAuditLog({
    tenantId: po.tenantId, action: "PO_CANCELLED", entityType: "purchase_order",
    entityId: poId, details: { reason: reason || "" }, performedBy: adminUid,
  });
};

async function recalcPOStatus(poId, _tenantId) {
  const itemsSnap = await getDocs(query(
    collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
    where("poId", "==", poId)
  ));
  const items = itemsSnap.docs.map((d) => d.data());
  if (items.length === 0) return;

  const allReceived = items.every((i) => i.quantityReceived >= i.quantityOrdered);
  const anyReceived = items.some((i) => i.quantityReceived > 0);

  let newStatus;
  if (allReceived) newStatus = "RECEIVED";
  else if (anyReceived) newStatus = "PARTIALLY_RECEIVED";
  else newStatus = "ORDERED";

  const updates = { status: newStatus, updatedAt: serverTimestamp() };
  if (newStatus === "RECEIVED") updates.receivedDate = serverTimestamp();

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), updates);
}

// ─── PROCUREMENT: Goods Receipts ───────────────────────────────────────────

export const createGoodsReceipt = async (data) => {
  const poSnap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, data.poId));
  if (!poSnap.exists()) throw new Error("PO not found");
  const po = poSnap.data();
  if (po.status !== "ORDERED" && po.status !== "PARTIALLY_RECEIVED") {
    throw new Error("PO must be ORDERED or PARTIALLY_RECEIVED to receive goods");
  }

  const poItemsSnap = await getDocs(query(
    collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
    where("poId", "==", data.poId)
  ));
  const poItems = {};
  poItemsSnap.docs.forEach((d) => { poItems[d.id] = d.data(); });

  const receiptNumber = await getNextCounter(data.tenantId, "GR");

  const grRef = await addDoc(collection(db, COLLECTIONS.GOODS_RECEIPTS), {
    tenantId: data.tenantId,
    poId: data.poId,
    receiptNumber,
    status: "DRAFT",
    receivedDate: data.receivedDate || new Date().toISOString().split("T")[0],
    referenceNumber: data.referenceNumber || "",
    notes: data.notes || "",
    receivedBy: data.createdBy,
    movementsCreated: false,
    cancelledBy: null, cancelledAt: null, cancellationReason: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  let lineNumber = 1;
  for (const item of (data.items || [])) {
    const poItem = poItems[item.poItemId];
    if (!poItem) throw new Error(`PO item ${item.poItemId} not found`);
    if (item.quantityReceived > poItem.quantityPending) {
      throw new Error(`Cannot receive ${item.quantityReceived} for item "${poItem.itemName}" — only ${poItem.quantityPending} pending`);
    }
    const qtyNowReceived = poItem.quantityReceived + item.quantityReceived;
    const qtyPending = poItem.quantityOrdered - qtyNowReceived;
    await addDoc(collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS), {
      tenantId: data.tenantId,
      receiptId: grRef.id,
      poItemId: item.poItemId,
      inventoryItemId: poItem.inventoryItemId,
      lineNumber: lineNumber++,
      itemName: poItem.itemName,
      unit: poItem.unit,
      quantityOrdered: poItem.quantityOrdered,
      quantityPreviouslyReceived: poItem.quantityReceived,
      quantityReceived: item.quantityReceived,
      quantityNowReceived: qtyNowReceived,
      quantityPending: qtyPending,
      unitCost: poItem.unitCost,
      totalCost: item.quantityReceived * poItem.unitCost,
      batchNumber: item.batchNumber || "",
      expiryDate: item.expiryDate || "",
      movementId: null,
      notes: item.notes || "",
      createdAt: serverTimestamp(),
    });
  }

  await writeProcurementAuditLog({
    tenantId: data.tenantId, action: "GR_CREATED", entityType: "goods_receipt",
    entityId: grRef.id, details: { receiptNumber, poNumber: po.poNumber, itemsCount: (data.items || []).length },
    performedBy: data.createdBy,
  });

  return { id: grRef.id, receiptNumber };
};

export const completeGoodsReceipt = async (receiptId, adminUid) => {
  const grSnap = await getDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, receiptId));
  if (!grSnap.exists()) throw new Error("Goods receipt not found");
  const gr = grSnap.data();
  if (gr.status !== "DRAFT") throw new Error("Only DRAFT goods receipt can be completed");

  const grItemsSnap = await getDocs(query(
    collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS),
    where("receiptId", "==", receiptId)
  ));
  const grItems = grItemsSnap.docs;

  const movementIds = [];
  for (const itemDoc of grItems) {
    const item = itemDoc.data();
    if (item.inventoryItemId) {
      const movementId = await createMovement({
        tenantId: gr.tenantId,
        itemId: item.inventoryItemId,
        type: "PURCHASE",
        quantity: item.quantityReceived,
        unitCost: item.unitCost,
        referenceType: "goods_receipt",
        referenceId: receiptId,
        notes: `GR ${gr.receiptNumber} / PO ref / ${item.itemName}`,
        createdBy: adminUid,
      });
      movementIds.push({ itemDocId: itemDoc.id, movementId });

      await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDER_ITEMS, item.poItemId), {
        quantityReceived: item.quantityNowReceived,
        quantityPending: item.quantityPending,
        updatedAt: serverTimestamp(),
      });

      await writeProcurementAuditLog({
        tenantId: gr.tenantId, action: "MOVEMENT_CREATED", entityType: "goods_receipt_item",
        entityId: itemDoc.id,
        details: { movementId, inventoryItemId: item.inventoryItemId, qty: item.quantityReceived, unitCost: item.unitCost },
        performedBy: adminUid,
      });
    }
  }

  for (const { itemDocId, movementId } of movementIds) {
    await updateDoc(doc(db, COLLECTIONS.GOODS_RECEIPT_ITEMS, itemDocId), { movementId });
  }

  await updateDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, receiptId), {
    status: "COMPLETED", movementsCreated: true, updatedAt: serverTimestamp(),
  });

  await recalcPOStatus(gr.poId, gr.tenantId);

  await writeProcurementAuditLog({
    tenantId: gr.tenantId, action: "GR_COMPLETED", entityType: "goods_receipt",
    entityId: receiptId, details: { movementsCreated: movementIds.length },
    performedBy: adminUid,
  });
};

export const cancelGoodsReceipt = async (receiptId, reason, adminUid) => {
  const snap = await getDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, receiptId));
  if (!snap.exists()) throw new Error("Goods receipt not found");
  const gr = snap.data();
  if (gr.movementsCreated) throw new Error("Cannot cancel goods receipt after movements have been created");
  if (gr.status !== "DRAFT") throw new Error("Only DRAFT goods receipt can be cancelled");

  await updateDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, receiptId), {
    status: "CANCELLED", cancelledBy: adminUid, cancelledAt: serverTimestamp(),
    cancellationReason: reason || "", updatedAt: serverTimestamp(),
  });
  await writeProcurementAuditLog({
    tenantId: gr.tenantId, action: "GR_CANCELLED", entityType: "goods_receipt",
    entityId: receiptId, details: { reason }, performedBy: adminUid,
  });
};

export const getGoodsReceiptsByPO = async (poId) => {
  const q = query(
    collection(db, COLLECTIONS.GOODS_RECEIPTS),
    where("poId", "==", poId),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getGoodsReceiptById = async (receiptId) => {
  const snap = await getDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, receiptId));
  if (!snap.exists()) return null;
  const gr = { id: snap.id, ...snap.data() };
  const itemsSnap = await getDocs(query(
    collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS),
    where("receiptId", "==", receiptId),
    orderBy("lineNumber", "asc")
  ));
  gr.items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return gr;
};