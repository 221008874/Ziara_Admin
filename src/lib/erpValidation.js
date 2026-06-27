/**
 * ERP Validation Utilities
 *
 * Reusable validation for ERP-related fields.
 * Follows the project's existing validation patterns (see Settings.jsx, Doctors.jsx).
 */

"use strict";

import { PLAN_KEYS } from "./licenseTemplates";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export const VALID_STATUSES = ["active", "inactive", "ACTIVE", "INACTIVE"];

export const VALID_LICENSE_STATUSES = ["active", "inactive", "expired", "ACTIVE", "INACTIVE", "EXPIRED"];

export const VALID_PLANS = PLAN_KEYS;

export const VALID_MODULES = [
  "patients",
  "appointments",
  "payments",
  "reports",
  "inventory",
  "procurement",
  "accounting",
];

// ──────────────────────────────────────────────
// Validation helpers
// ──────────────────────────────────────────────

/**
 * Validate an expiration date string.
 * Accepts "YYYY-MM-DD" or ISO date string.
 * Returns null if valid, or an error message string.
 */
export function validateExpiryDate(value) {
  if (!value || typeof value !== "string") {
    return "Expiration date is required";
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return "Invalid date format. Use YYYY-MM-DD.";
  }
  return null;
}

/**
 * Validate a numeric limit value.
 * -1 means unlimited (ENTERPRISE).  Otherwise must be >= 0.
 */
export function validateLimit(value, label = "Limit") {
  if (value === undefined || value === null) {
    return `${label} is required`;
  }
  const num = Number(value);
  if (!Number.isInteger(num)) {
    return `${label} must be a whole number`;
  }
  if (num < -1) {
    return `${label} must be -1 (unlimited) or greater`;
  }
  return null;
}

/**
 * Validate a plan value.
 */
export function validatePlan(value) {
  if (!value) return "Plan is required";
  if (!VALID_PLANS.includes(value)) {
    return `Invalid plan "${value}". Must be one of: ${VALID_PLANS.join(", ")}`;
  }
  return null;
}

/**
 * Validate a tenant status value.
 */
export function validateTenantStatus(value) {
  if (!value) return "Status is required";
  if (!VALID_STATUSES.includes(value)) {
    return `Invalid status "${value}". Must be "active" or "inactive".`;
  }
  return null;
}

/**
 * Validate a license status value.
 */
export function validateLicenseStatus(value) {
  if (!value) return "Status is required";
  if (!VALID_LICENSE_STATUSES.includes(value)) {
    return `Invalid status "${value}". Must be one of: active, inactive, expired.`;
  }
  return null;
}

/**
 * Validate module names.
 * Pass the wildcard "*" for ENTERPRISE (all modules).
 * Returns array of error messages (empty = valid).
 */
export function validateModules(modules) {
  const errors = [];
  if (!Array.isArray(modules)) {
    return ["Modules must be an array"];
  }
  if (modules.length === 0) {
    errors.push("At least one module must be enabled");
    return errors;
  }
  for (const m of modules) {
    if (m === "*") continue; // wildcard = all modules, valid for ENTERPRISE
    if (!VALID_MODULES.includes(m)) {
      errors.push(`Unknown module "${m}". Valid modules: ${VALID_MODULES.join(", ")}`);
    }
  }
  return errors;
}

/**
 * Validate all ERP settings fields.
 * Returns { valid: boolean, errors: Record<string, string[]> }
 */
export function validateERPSettings(data) {
  const errors = {};

  const planErr = validatePlan(data.plan);
  if (planErr) errors.plan = [planErr];

  const statusErr = validateTenantStatus(data.status);
  if (statusErr) errors.status = [statusErr];

  const licStatusErr = validateLicenseStatus(data.licenseStatus);
  if (licStatusErr) errors.licenseStatus = [licStatusErr];

  const expiryErr = data.licenseExpiry ? validateExpiryDate(data.licenseExpiry) : null;
  if (expiryErr) errors.licenseExpiry = [expiryErr];

  const userErr = validateLimit(data.maxUsers, "User limit");
  if (userErr) errors.maxUsers = [userErr];

  const doctorErr = validateLimit(data.maxDoctors, "Doctor limit");
  if (doctorErr) errors.maxDoctors = [doctorErr];

  const moduleErrs = validateModules(data.enabledModules || []);
  if (moduleErrs.length > 0) errors.enabledModules = moduleErrs;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
