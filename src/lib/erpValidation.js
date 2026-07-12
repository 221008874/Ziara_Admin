/**
 * ERP Settings Validation
 *
 * Pure validation functions returning arrays of error messages.
 * Empty array = valid.
 * All functions are non-blocking — they only report, never throw.
 */

export function validateExpiryDate(value) {
  const errors = [];
  if (!value) return errors;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    errors.push("Invalid date format");
  }
  return errors;
}

export function validateLimit(value, label, planUnlimited = false) {
  const errors = [];
  if (planUnlimited) return errors;
  const n = Number(value);
  if (value === "" || value === null || value === undefined) {
    errors.push(`${label} is required`);
  } else if (!Number.isInteger(n) || n < 0) {
    errors.push(`${label} must be a non-negative integer`);
  }
  return errors;
}

export function validatePlan(planId) {
  const errors = [];
  const valid = ["BASIC", "PRO", "ENTERPRISE"];
  if (!planId) {
    errors.push("Plan is required");
  } else if (!valid.includes(planId)) {
    errors.push(`Invalid plan "${planId}". Must be BASIC, PRO, or ENTERPRISE`);
  }
  return errors;
}

export function validateModules(modules) {
  const errors = [];
  if (!Array.isArray(modules) || modules.length === 0) {
    errors.push("At least one module must be enabled");
  }
  return errors;
}

export function validateERPSettings(settings) {
  const errors = [];
  const plan = settings.plan || "BASIC";
  const isEnterprise = plan === "ENTERPRISE";
  errors.push(...validatePlan(plan));
  errors.push(...validateLimit(settings.maxUsers, "Max users", isEnterprise));
  errors.push(...validateLimit(settings.maxDoctors, "Max doctors", isEnterprise));
  errors.push(...validateModules(settings.enabledModules));
  if (settings.expiresAt) {
    errors.push(...validateExpiryDate(settings.expiresAt));
  }
  return errors;
}
