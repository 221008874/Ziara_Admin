import { collection, getDocs, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./core";
import { getAllTenants } from "./tenants";

// ###########################################################################
// ERP SaaS INTEGRATION
// ###########################################################################
// These operations extend the Admin Panel to support ERP-level tenant and
// license metadata.  They are additive — existing collections and fields
// are never removed or renamed.
// ###########################################################################

// ──────────────────────────────────────────────
// ERP: Read tenant + license for ERP Settings page
// ──────────────────────────────────────────────

/**
 * Get a single tenant by ID with full ERP metadata.
 */
export const getTenantById = async (tenantId) => {
  const snap = await getDoc(doc(db, COLLECTIONS.SAAS_TENANTS, tenantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

/**
 * Update ERP-specific tenant fields only.
 * Never touches existing tenant fields like name, address, etc.
 */
export const updateTenantERPFields = async (tenantId, erpFields) => {
  const allowed = [
    "erpEnabled",
    "status",
    "plan",
  ];
  const updates = {};
  for (const key of allowed) {
    if (erpFields[key] !== undefined) {
      updates[key] = erpFields[key];
    }
  }
  updates.updatedAt = serverTimestamp();

  await updateDoc(doc(db, COLLECTIONS.SAAS_TENANTS, tenantId), updates);

  // Sync status change to comm_tenants
  if (erpFields.status !== undefined) {
    await updateDoc(doc(db, COLLECTIONS.COMM_TENANTS, tenantId), {
      active: erpFields.status === "ACTIVE" || erpFields.status === "active",
      visibility: (erpFields.status === "ACTIVE" || erpFields.status === "active") ? "PUBLIC" : "HIDDEN",
      _syncedAt: serverTimestamp(),
    });
  }
};

// ──────────────────────────────────────────────
// ERP: License management (additive fields)
// ──────────────────────────────────────────────

/**
 * Get a single license by key.
 */
export const getLicenseByKey = async (licenseKey) => {
  const snap = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

/**
 * Update ERP-specific license fields only.
 * Leaves existing license fields (doctorName, phone, deviceId, etc.) untouched.
 */
export const updateLicenseERPFields = async (licenseKey, erpFields) => {
  const allowed = [
    "tenantId",
    "plan",
    "status",
    "expiresAt",
    "maxUsers",
    "maxDoctors",
    "enabledModules",
  ];
  const updates = {};
  for (const key of allowed) {
    if (erpFields[key] !== undefined) {
      updates[key] = erpFields[key];
    }
  }
  updates.updatedAt = serverTimestamp();

  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), updates);
};

// ──────────────────────────────────────────────
// ERP: Migration utility (idempotent)
// ──────────────────────────────────────────────

/**
 * Migrate all existing tenants and licenses with ERP defaults.
 *
 * This is safe to run multiple times — it only sets fields that are
 * missing/undefined.  Existing data is never overwritten.
 *
 * Returns a summary object: { tenantsUpdated, licensesUpdated, errors }
 */
export const migrateERPFields = async () => {
  let tenantsUpdated = 0;
  let licensesUpdated = 0;
  const errors = [];

  // ── Migrate tenants ──
  try {
    const tenantSnap = await getDocs(collection(db, COLLECTIONS.SAAS_TENANTS));
    for (const t of tenantSnap.docs) {
      const data = t.data();
      const updates = {};
      if (data.erpEnabled === undefined) updates.erpEnabled = false;
      if (data.status === undefined) updates.status = "ACTIVE";
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = serverTimestamp();
        await updateDoc(doc(db, COLLECTIONS.SAAS_TENANTS, t.id), updates);
        tenantsUpdated++;
      }
    }
  } catch (e) {
    errors.push("Tenant migration error: " + e.message);
  }

  // ── Migrate licenses ──
  try {
    const licSnap = await getDocs(collection(db, COLLECTIONS.SAAS_LICENSES));
    for (const l of licSnap.docs) {
      const data = l.data();
      const updates = {};
      if (data.plan === undefined) updates.plan = "BASIC";
      if (data.maxUsers === undefined) updates.maxUsers = 5;
      if (data.maxDoctors === undefined) updates.maxDoctors = 2;
      if (data.enabledModules === undefined) {
        updates.enabledModules = ["patients", "appointments"];
      }
      if (data.tenantId === undefined) updates.tenantId = "";
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = serverTimestamp();
        await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, l.id), updates);
        licensesUpdated++;
      }
    }
  } catch (e) {
    errors.push("License migration error: " + e.message);
  }

  return { tenantsUpdated, licensesUpdated, errors };
};

// ──────────────────────────────────────────────
// ERP: Trigger cache reconciliation
// ──────────────────────────────────────────────

/**
 * Trigger ERP sync to propagate changes immediately instead of waiting
 * for the 5-minute cache TTL.
 * Returns { success: boolean, message: string }
 */
export const triggerERPSync = async () => {
  const syncUrl = import.meta.env.VITE_ERP_SYNC_URL;
  if (!syncUrl) {
    return { success: true, message: "ERP sync URL not configured (set VITE_ERP_SYNC_URL)" };
  }
  try {
    const response = await fetch(`${syncUrl}?reconcile=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { success: false, message: `ERP sync returned ${response.status}` };
    }
    return { success: true, message: "ERP cache refreshed" };
  } catch {
    // ERP may not be reachable from Admin Panel; this is non-critical
    return { success: false, message: "ERP not reachable — cache will refresh in ~5 min" };
  }
};

// ──────────────────────────────────────────────
// ERP: Get all ERP settings for all tenants (admin view)
// ──────────────────────────────────────────────

/**
 * Return all tenants with their corresponding license ERP data merged.
 * Used by the ERP Settings page table.
 */
export const getERPEnrichedTenants = async () => {
  const tenants = await getAllTenants();
  const enriched = [];

  for (const t of tenants) {
    let licenseData = null;
    if (t.licenseKey) {
      const lic = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, t.licenseKey));
      if (lic.exists()) {
        licenseData = lic.data();
      }
    }
    enriched.push({
      ...t,
      erpEnabled: t.erpEnabled ?? false,
      licenseERP: licenseData
        ? {
            plan: licenseData.plan,
            status: licenseData.status,
            expiresAt: licenseData.expiresAt,
            maxUsers: licenseData.maxUsers,
            maxDoctors: licenseData.maxDoctors,
            enabledModules: licenseData.enabledModules,
            tenantId: licenseData.tenantId,
          }
        : null,
    });
  }

  return enriched;
};