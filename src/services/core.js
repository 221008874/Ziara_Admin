// src/services/core.js — shared constants, helpers, and public-field builders
import { serverTimestamp } from "firebase/firestore";
import { isBilingual, createBilingual } from "../lib/i18n";

export const COLLECTIONS = {
  SAAS_TENANTS: "saas_tenants",
  SAAS_DOCTORS: "saas_doctors",
  SAAS_LICENSES: "saas_licenses",
  SAAS_SETTINGS: "saas_settings",
  COMM_DOCTORS: "comm_doctors",
  COMM_TENANTS: "comm_tenants",
  COMM_APPOINTMENTS: "comm_appointments",
  COMM_PATIENTS: "comm_patients",
  COMM_DOCTOR_USERS: "comm_doctor_users", // 🔑 NEW: For doctor auth mapping
  SYNC_QUEUE: "sync_queue",
  SERVERS: "servers",
  APP_VERSIONS: "app_versions",
  INVENTORY_CATEGORIES: "inventory_categories",
  INVENTORY_ITEMS: "inventory_items",
  INVENTORY_MOVEMENTS: "inventory_movements",
  INVENTORY_ADJUSTMENTS: "inventory_adjustments",
  INVENTORY_STOCK_COUNTS: "inventory_stock_counts",
  INVENTORY_AUDIT_LOG: "inventory_audit_log",
  SUPPLIERS: "suppliers",
  PURCHASE_ORDERS: "purchase_orders",
  PURCHASE_ORDER_ITEMS: "purchase_order_items",
  GOODS_RECEIPTS: "goods_receipts",
  GOODS_RECEIPT_ITEMS: "goods_receipt_items",
  PROCUREMENT_AUDIT_LOG: "procurement_audit_log",
  PROCUREMENT_META: "procurement_meta",
};

// ─── BILINGUAL FIELD NORMALIZER ─────────────────────────────────────────────
// Accepts raw value (string or {en, ar}) and always returns {en, ar}
export function normalizeBilingual(raw, fallbackEn = "", fallbackAr = "") {
  if (isBilingual(raw)) return raw;
  if (typeof raw === "string") return createBilingual(raw, raw);
  return createBilingual(fallbackEn, fallbackAr);
}

// ─── SPECIALIZATION DISPLAY LOOKUP ────────────────────────────────────────
const SPECIALIZATION_DISPLAY = {
  general_practice:  { en: "General Practice",     ar: "طب عام" },
  internal_medicine: { en: "Internal Medicine",    ar: "طب باطني" },
  pediatrics:        { en: "Pediatrics",           ar: "طب أطفال" },
  cardiology:        { en: "Cardiology",           ar: "طب القلب" },
  dermatology:       { en: "Dermatology",          ar: "طب جلدية" },
  orthopedics:       { en: "Orthopedics",          ar: "جراحة عظام" },
  neurology:         { en: "Neurology",            ar: "طب أعصاب" },
  ophthalmology:     { en: "Ophthalmology",        ar: "طب عيون" },
  ent:               { en: "ENT",                  ar: "أنف وأذن وحنجرة" },
  psychiatry:        { en: "Psychiatry",           ar: "طب نفسي" },
  dentistry:         { en: "Dentistry",            ar: "طب أسنان" },
  gynecology:        { en: "Gynecology",           ar: "نساء وتوليد" },
  general_surgery:   { en: "General Surgery",      ar: "جراحة عامة" },
  urology:           { en: "Urology",              ar: "جراحة مسالك" },
  anesthesia:        { en: "Anesthesiology",       ar: "تخدير" },
  radiology:         { en: "Radiology",            ar: "أشعة" },
  pathology:         { en: "Pathology",            ar: "باثولوجيا" },
  other:             { en: "Other",                ar: "أخرى" },
};

export function resolveSpecialty(raw) {
  if (isBilingual(raw)) return raw;
  if (typeof raw === "string") {
    const mapped = SPECIALIZATION_DISPLAY[raw];
    if (mapped) return createBilingual(mapped.en, mapped.ar);
    return createBilingual(raw, raw);
  }
  return createBilingual("", "");
}

export function resolveSpecialtyKey(raw) {
  if (typeof raw === "string") {
    return SPECIALIZATION_DISPLAY[raw] ? raw : raw;
  }
  return raw?.en || raw?.ar || "";
}

// ─── PUBLIC-SAFE FIELD BUILDERS (exported for domain modules) ─────────────────────────────────────────────
export function buildPublicDoctor(data, doctorId) {
  const nameB = normalizeBilingual(data.name);
  const specialtyB = resolveSpecialty(data.specialization || data.specialty);
  const specialtyKey = resolveSpecialtyKey(data.specialization || data.specialty);
  return {
    name: nameB,
    nameEn: nameB.en || '',
    specialty: specialtyB,
    specialtyEn: specialtyB.en || '',
    specialtyKey,
    bio: normalizeBilingual(data.bio),
    photoUrl: data.photoUrl || "",
    tenantId: data.tenantId || data.clinicId || "",
    providerId: data.providerId || data.tenantId || "",
    clinicName: normalizeBilingual(data.tenantName || data.clinicName),
    city: normalizeBilingual(data.city),
    address: normalizeBilingual(data.address),
    workingDays: data.workingDays || [],
    timeSlots: data.timeSlots || [],
    education: normalizeBilingual(data.education),
    languages: Array.isArray(data.languages) ? data.languages.map(l => normalizeBilingual(l)) : [],
    yearsOfExperience: data.yearsOfExperience || null,
    active: data.status === "ACTIVE",
    visibility: data.status === "ACTIVE" ? "PUBLIC" : "HIDDEN",
    availableToday: false,
    licenseKey: data.licenseKey || null,
    _syncedAt: serverTimestamp(),
    _sourceId: doctorId,
  };
}

export function buildPublicTenant(data, tenantId) {
  return {
    id: tenantId,
    name: normalizeBilingual(data.name || data.clinicName),
    providerType: data.providerType || "CLINIC",
    city: normalizeBilingual(data.city),
    address: normalizeBilingual(data.address),
    logoUrl: data.logoUrl || "",
    description: normalizeBilingual(data.description),
    active: data.status === "ACTIVE",
    visibility: data.status === "ACTIVE" ? "PUBLIC" : "HIDDEN",
    _syncedAt: serverTimestamp(),
    _sourceId: tenantId,
  };
}
