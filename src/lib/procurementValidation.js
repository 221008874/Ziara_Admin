"use strict";

import { isBilingual } from "./i18n";

export const PO_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"];

export const GR_STATUSES = ["DRAFT", "COMPLETED", "CANCELLED"];

export const SUPPLIER_STATUSES = ["ACTIVE", "INACTIVE", "DELETED"];

export const PAYMENT_TERMS = ["NET15", "NET30", "NET60", "CASH", "COD"];

export const CURRENCIES = ["SAR", "USD", "EUR", "AED", "EGP"];

export const PO_TRANSITIONS = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["ORDERED", "CANCELLED"],
  ORDERED: ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "CLOSED"],
  RECEIVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export function validatePOTransition(currentStatus, newStatus) {
  const allowed = PO_TRANSITIONS[currentStatus];
  if (!allowed) return `Unknown status "${currentStatus}"`;
  if (!allowed.includes(newStatus)) {
    return `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowed.join(", ") || "none"}`;
  }
  return null;
}

export function validatePOItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "At least one item is required";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.itemName || !item.itemName.en) return `Item ${i + 1}: name is required`;
    if (!item.quantityOrdered || item.quantityOrdered <= 0) return `Item ${i + 1}: quantity must be > 0`;
    if (item.unitCost === undefined || item.unitCost < 0) return `Item ${i + 1}: unit cost must be >= 0`;
  }
  return null;
}

export function validateSupplierName(name) {
  if (!name) return "Supplier name is required";
  if (!isBilingual(name)) return "Supplier name must be bilingual ({ en, ar })";
  if (!name.en?.trim()) return "English name is required";
  if (!name.ar?.trim()) return "Arabic name is required";
  return null;
}

export function validateReceiptQuantity(received, pending) {
  if (received === undefined || received === null) return "Received quantity is required";
  const num = Number(received);
  if (!Number.isInteger(num) || num < 0) return "Received quantity must be a non-negative integer";
  if (num > pending) return `Cannot receive more than pending quantity (${pending})`;
  return null;
}

export function validatePONumber(poNumber) {
  if (!poNumber) return "PO number is required";
  if (!/^PO-\d{4}-\d{5}$/.test(poNumber)) return "PO number must follow format PO-YYYY-XXXXX";
  return null;
}

export function validateProcurementData(type, data) {
  if (type === "supplier") {
    const errors = {};
    const nameErr = validateSupplierName(data.name);
    if (nameErr) errors.name = [nameErr];
    return { valid: Object.keys(errors).length === 0, errors };
  }
  if (type === "po") {
    const errors = {};
    if (!data.supplierId) errors.supplierId = ["Supplier is required"];
    const itemsErr = validatePOItems(data.items);
    if (itemsErr) errors.items = [itemsErr];
    return { valid: Object.keys(errors).length === 0, errors };
  }
  return { valid: true, errors: {} };
}
