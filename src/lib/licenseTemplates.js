/**
 * License Templates (Plan Definitions)
 *
 * Centralised plan limits used by the ERP integration and the ERP Settings UI.
 * When a plan is selected, populate maxUsers, maxDoctors, and enabledModules
 * automatically. Administrators may override limits manually.
 *
 * -1 = unlimited (ENTERPRISE)
 */

"use strict";

export const PLANS = {
  BASIC: {
    id: "BASIC",
    label: "BASIC",
    maxUsers: 5,
    maxDoctors: 2,
    enabledModules: ["patients", "appointments"],
  },
  PRO: {
    id: "PRO",
    label: "PRO",
    maxUsers: 20,
    maxDoctors: 10,
    enabledModules: ["patients", "appointments", "payments", "reports"],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    label: "ENTERPRISE",
    maxUsers: -1,
    maxDoctors: -1,
    enabledModules: ["*"],
  },
};

export const PLAN_KEYS = Object.keys(PLANS);

/**
 * Get the default template for a plan.
 * Returns a plain object safe for Firestore writes.
 */
export function getPlanTemplate(planId) {
  const plan = PLANS[planId];
  if (!plan) return null;
  return {
    plan: plan.id,
    maxUsers: plan.maxUsers,
    maxDoctors: plan.maxDoctors,
    enabledModules: [...plan.enabledModules],
  };
}

/**
 * Apply a plan template on top of existing values.
 * Only fills fields that are undefined/null — never overrides manual overrides.
 */
export function applyPlanTemplate(planId, existing = {}) {
  const tmpl = getPlanTemplate(planId);
  if (!tmpl) return existing;
  return {
    ...tmpl,
    ...existing,
    plan: planId,
    maxUsers: existing.maxUsers ?? tmpl.maxUsers,
    maxDoctors: existing.maxDoctors ?? tmpl.maxDoctors,
    enabledModules: existing.enabledModules ?? [...tmpl.enabledModules],
  };
}

/**
 * All valid ERP module names.
 */
export const ALL_MODULES = [
  "patients",
  "appointments",
  "payments",
  "reports",
  "inventory",
  "procurement",
  "accounting",
];

/**
 * Human-readable labels for each module.
 */
export const MODULE_LABELS = {
  patients:     { en: "Patients",     ar: "المرضى" },
  appointments: { en: "Appointments",  ar: "المواعيد" },
  payments:     { en: "Payments",      ar: "المدفوعات" },
  reports:      { en: "Reports",       ar: "التقارير" },
  inventory:    { en: "Inventory",     ar: "المخزون" },
  procurement:  { en: "Procurement",   ar: "المشتريات" },
  accounting:   { en: "Accounting",    ar: "المحاسبة" },
};
