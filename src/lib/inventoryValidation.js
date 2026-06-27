"use strict";

import { isBilingual } from "./i18n";

export const MOVEMENT_TYPES = ["PURCHASE", "CONSUMPTION", "RETURN", "ADJUSTMENT", "TRANSFER", "OPENING_BALANCE"];

export const ITEM_UNITS = ["piece", "box", "bottle", "pack", "kg", "liter", "meter", "strip", "vial", "other"];

export const ADJUSTMENT_REASONS = ["DAMAGE", "LOSS", "FOUND", "EXPIRY", "MANUAL"];

export const ITEM_STATUSES = ["ACTIVE", "INACTIVE", "DELETED", "OUT_OF_STOCK"];

export const CATEGORY_STATUSES = ["ACTIVE", "INACTIVE", "DELETED"];

export const STOCK_COUNT_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "RECONCILED"];

export const ADJUSTMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export function validateSKU(sku) {
  if (!sku || typeof sku !== "string") return "SKU is required";
  if (!/^[A-Za-z0-9\-]+$/.test(sku)) return "SKU must be alphanumeric with hyphens only";
  return null;
}

export function validateQuantity(qty) {
  if (qty === undefined || qty === null) return "Quantity is required";
  const num = Number(qty);
  if (!Number.isInteger(num) || num <= 0) return "Quantity must be a positive integer";
  return null;
}

export function validateUnitCost(cost) {
  if (cost === undefined || cost === null) return null;
  const num = Number(cost);
  if (isNaN(num) || num < 0) return "Unit cost must be a non-negative number";
  return null;
}

export function validateItemName(name) {
  if (!name) return "Item name is required";
  if (!isBilingual(name)) return "Item name must be bilingual ({ en, ar })";
  if (!name.en?.trim()) return "English name is required";
  if (!name.ar?.trim()) return "Arabic name is required";
  return null;
}

export function validateMovementType(type) {
  if (!type) return "Movement type is required";
  if (!MOVEMENT_TYPES.includes(type)) return `Invalid movement type "${type}". Must be one of: ${MOVEMENT_TYPES.join(", ")}`;
  return null;
}

export function validateInventoryItem(data) {
  const errors = {};
  const skuErr = validateSKU(data.SKU);
  if (skuErr) errors.SKU = [skuErr];
  const nameErr = validateItemName(data.name);
  if (nameErr) errors.name = [nameErr];
  if (!data.unit) errors.unit = ["Unit is required"];
  else if (!ITEM_UNITS.includes(data.unit)) errors.unit = [`Invalid unit "${data.unit}"`];
  if (!data.categoryId) errors.categoryId = ["Category is required"];
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCategory(data) {
  const errors = {};
  if (!data.name) errors.name = ["Category name is required"];
  else if (!isBilingual(data.name)) errors.name = ["Category name must be bilingual ({ en, ar })"];
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateAdjustment(data) {
  const errors = {};
  if (!data.itemId) errors.itemId = ["Item is required"];
  if (!data.reason) errors.reason = ["Reason is required"];
  else if (!ADJUSTMENT_REASONS.includes(data.reason)) errors.reason = [`Invalid reason "${data.reason}"`];
  if (data.actualQty === undefined || data.actualQty === null) errors.actualQty = ["Actual quantity is required"];
  else if (typeof Number(data.actualQty) !== "number") errors.actualQty = ["Actual quantity must be a number"];
  return { valid: Object.keys(errors).length === 0, errors };
}
