// src/services/firestoreService.js
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
  limit,
  startAfter,
  getDoc,
  writeBatch,
} from "firebase/firestore";

// ─── CRITICAL: db must be from the SAME modular SDK instance ──────────────
import { db } from "../firebase";

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
  SERVERS: "clinic_servers",
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
function normalizeBilingual(raw, fallbackEn = "", fallbackAr = "") {
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

function resolveSpecialty(raw) {
  if (isBilingual(raw)) return raw;
  if (typeof raw === "string") {
    const mapped = SPECIALIZATION_DISPLAY[raw];
    if (mapped) return createBilingual(mapped.en, mapped.ar);
    return createBilingual(raw, raw);
  }
  return createBilingual("", "");
}

function resolveSpecialtyKey(raw) {
  if (typeof raw === "string") {
    return SPECIALIZATION_DISPLAY[raw] ? raw : raw;
  }
  return raw?.en || raw?.ar || "";
}

// ─── PUBLIC-SAFE FIELD BUILDERS ─────────────────────────────────────────────
function buildPublicDoctor(data, doctorId) {
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

function buildPublicTenant(data, tenantId) {
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

// ─── LICENSES ───────────────────────────────────────────────────────────────
export const createLicense = async (licenseData) => {
  const { licenseKey, ...data } = licenseData;
  // Check uniqueness first
  const existing = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
  if (existing.exists()) {
    throw new Error(`License key "${licenseKey}" already exists`);
  }
  await setDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), {
    ...data,
    licenseKey,
    category: data.category || "doctor",
    status: data.status || "ACTIVE",
    expired: false,
    onlineBooking: Boolean(data.onlineBooking),
    deviceId: null,
    createdAt: serverTimestamp(),
  });
};

export const getAllLicenses = async () => {
  const q = query(
    collection(db, COLLECTIONS.SAAS_LICENSES),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const updateLicenseStatus = async (docId, newStatus) => {
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, docId), {
    status: newStatus,
  });
};

export const updateLicenseExpiry = async (licenseKey, newExpiryDate) => {
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), {
    expiryDate: newExpiryDate,
    status: "ACTIVE",
    expired: false,
  });
};

export const updateLicenseOnlineBooking = async (licenseKey, enabled) => {
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), {
    onlineBooking: Boolean(enabled),
  });
};

// ─── TENANTS (SaaS + COMM dual-write) ─────────────────────────────────────
export const createTenant = async (tenantData) => {
  const { licenseKey, expiryDate, ...tenantFields } = tenantData;

  // Create or validate license for the tenant
  if (licenseKey) {
    const licSnap = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
    if (!licSnap.exists()) {
      await createLicense({
        licenseKey,
        category: "tenant",
        expiryDate: expiryDate || "",
        status: "ACTIVE",
      });
    }
  }

  // 1. Write to saas_tenants
  const saasRef = await addDoc(collection(db, COLLECTIONS.SAAS_TENANTS), {
    ...tenantFields,
    licenseKey: licenseKey || "",
    expiryDate: expiryDate || "",
    status: "ACTIVE",
    createdAt: serverTimestamp(),
  });

  // 2. Mirror to comm_tenants
  const publicTenant = buildPublicTenant(
    { ...tenantFields, licenseKey, status: "ACTIVE" },
    saasRef.id
  );
  await setDoc(doc(db, COLLECTIONS.COMM_TENANTS, saasRef.id), publicTenant);

  return saasRef.id;
};

export const getAllTenants = async () => {
  const q = query(
    collection(db, COLLECTIONS.SAAS_TENANTS),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const updateTenantStatus = async (tenantId, newStatus) => {
  // 1. Update saas_tenants
  await updateDoc(doc(db, COLLECTIONS.SAAS_TENANTS, tenantId), {
    status: newStatus,
  });

  // 2. Sync visibility to comm_tenants
  await updateDoc(doc(db, COLLECTIONS.COMM_TENANTS, tenantId), {
    active: newStatus === "ACTIVE",
    visibility: newStatus === "ACTIVE" ? "PUBLIC" : "HIDDEN",
    _syncedAt: serverTimestamp(),
  });
};

export const updateTenant = async (tenantId, updates) => {
  // 1. Update saas_tenants
  await updateDoc(doc(db, COLLECTIONS.SAAS_TENANTS, tenantId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // 2. Sync allowed fields to comm_tenants (supports bilingual {en, ar})
  const publicUpdates = {};
  [
    "name",
    "clinicName",
    "city",
    "address",
    "logoUrl",
    "description",
    "providerType",
  ].forEach((f) => {
    if (updates[f] !== undefined) publicUpdates[f] = updates[f];
  });
  if (Object.keys(publicUpdates).length > 0) {
    publicUpdates._syncedAt = serverTimestamp();
    await updateDoc(doc(db, COLLECTIONS.COMM_TENANTS, tenantId), publicUpdates);
  }
};

export const deleteTenant = async (tenantId) => {
  // 1. Delete from saas_tenants
  await deleteDoc(doc(db, COLLECTIONS.SAAS_TENANTS, tenantId));

  // 2. Delete from comm_tenants
  await deleteDoc(doc(db, COLLECTIONS.COMM_TENANTS, tenantId));

  // 3. Soft-delete associated doctors and clean up their user mappings
  const doctorsQuery = query(
    collection(db, COLLECTIONS.SAAS_DOCTORS),
    where("tenantId", "==", tenantId)
  );
  const doctorsSnap = await getDocs(doctorsQuery);
  for (const d of doctorsSnap.docs) {
    await deleteDoc(d.ref);
    const userMapQuery = query(
      collection(db, COLLECTIONS.COMM_DOCTOR_USERS),
      where("doctorId", "==", d.id)
    );
    const userMaps = await getDocs(userMapQuery);
    for (const u of userMaps.docs) {
      await deleteDoc(u.ref);
    }
  }
  // Also hide public doctor listings
  const commDoctorsQuery = query(
    collection(db, COLLECTIONS.COMM_DOCTORS),
    where("tenantId", "==", tenantId)
  );
  const commDoctorsSnap = await getDocs(commDoctorsQuery);
  for (const d of commDoctorsSnap.docs) {
    await deleteDoc(d.ref);
  }

  // 4. Delete inventory data for this tenant
  const deleteCollectionByTenant = async (collectionName) => {
    const snap = await getDocs(
      query(collection(db, collectionName), where("tenantId", "==", tenantId))
    );
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.docs.length > 0) await batch.commit();
  };
  await deleteCollectionByTenant(COLLECTIONS.SUPPLIERS);
  await deleteCollectionByTenant(COLLECTIONS.PURCHASE_ORDERS);
  await deleteCollectionByTenant(COLLECTIONS.PURCHASE_ORDER_ITEMS);
  await deleteCollectionByTenant(COLLECTIONS.INVENTORY_ITEMS);
  await deleteCollectionByTenant(COLLECTIONS.INVENTORY_ADJUSTMENTS);
  await deleteCollectionByTenant(COLLECTIONS.INVENTORY_MOVEMENTS);
  await deleteCollectionByTenant(COLLECTIONS.INVENTORY_STOCK_COUNTS);

  // 5. Delete tenant licenses
  const licensesQuery = query(
    collection(db, COLLECTIONS.SAAS_LICENSES),
    where("tenantId", "==", tenantId)
  );
  const licensesSnap = await getDocs(licensesQuery);
  for (const l of licensesSnap.docs) {
    await deleteDoc(l.ref);
  }
};

// ─── DOCTORS (SaaS + COMM dual-write) ─────────────────────────────────────
export const createDoctor = async (doctorData) => {
  const { password, confirmPassword, licenseKey, ...doctorPublicData } = doctorData;

  // If individual doctor (no tenantId) and licenseKey provided, create license
  if (licenseKey && !doctorPublicData.tenantId) {
    const licSnap = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
    if (!licSnap.exists()) {
      await createLicense({
        licenseKey,
        category: "doctor",
        doctorName: doctorPublicData.name || doctorData.name,
        phone: doctorPublicData.phone || "",
        expiryDate: "",
      });
    }
  }

  // If doctor belongs to tenant, validate tenant's license exists
  if (licenseKey && doctorPublicData.tenantId) {
    const licSnap = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
    if (!licSnap.exists()) {
      throw new Error(`License key "${licenseKey}" not found. Create the tenant license first.`);
    }
  }

  // Pre-generate the saas_doctors doc ID
  const doctorId = doc(collection(db, COLLECTIONS.SAAS_DOCTORS)).id;

  // 1. Write to saas_doctors (internal admin data)
  await setDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId), {
    ...doctorPublicData,
    licenseKey: licenseKey || "",
    status: "ACTIVE",
    createdAt: serverTimestamp(),
  });

  try {
    // 2. Write mapping in comm_doctor_users (if email provided)
    if (doctorData.email) {
      await setDoc(
        doc(db, COLLECTIONS.COMM_DOCTOR_USERS, doctorData.email.toLowerCase()),
        {
          doctorId,
          email: doctorData.email.toLowerCase(),
          firebaseUid: "",
          firstLogin: true,
          createdAt: serverTimestamp(),
        }
      );
    }

    // 3. Mirror to comm_doctors
    const publicDoctor = buildPublicDoctor(
      { ...doctorPublicData, licenseKey, status: "ACTIVE" },
      doctorId
    );
    await setDoc(doc(db, COLLECTIONS.COMM_DOCTORS, doctorId), publicDoctor);
  } catch (firestoreErr) {
    console.error("Firestore write failed, cleaning up saas_doctors:", firestoreErr);
    await deleteDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId));
    throw firestoreErr;
  }

  // 4. Create Firebase Auth account LAST (no rollback needed if this fails — Firestore data exists)
  if (doctorData.email && password) {
    try {
      const apiBase = import.meta.env.VITE_API_BASE || "";
      const res = await fetch(`${apiBase}/api/admin/create-doctor-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: doctorData.email,
          password,
          uid: doctorId,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create doctor account");
      // Update comm_doctor_users with the Firebase UID
      await updateDoc(doc(db, COLLECTIONS.COMM_DOCTOR_USERS, doctorData.email.toLowerCase()), {
        firebaseUid: result.firebaseUid,
      });
    } catch (authErr) {
      console.error("Auth creation failed (Firestore data already saved, retry safe):", authErr);
      throw authErr;
    }
  }

  // 5. Ensure tenant exists in comm_tenants (only if belongs to a tenant)
  if (doctorData.tenantId) {
    const tenantRef = doc(
      db,
      COLLECTIONS.COMM_TENANTS,
      doctorData.tenantId
    );
    const tenantSnap = await getDoc(tenantRef);
    if (!tenantSnap.exists()) {
      const saasTenantSnap = await getDoc(
        doc(db, COLLECTIONS.SAAS_TENANTS, doctorData.tenantId)
      );
      await setDoc(tenantRef, {
        id: doctorData.tenantId,
        name: saasTenantSnap.exists()
          ? saasTenantSnap.data().name
          : "Unknown Clinic",
        active: true,
        visibility: "PUBLIC",
        _syncedAt: serverTimestamp(),
      }).catch((e) =>
        console.error("Tenant sync to comm_tenants failed (non-fatal):", e)
      );
    }
  }

  return doctorId;
};

export const getAllDoctors = async () => {
  const q = query(
    collection(db, COLLECTIONS.SAAS_DOCTORS),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getPublicDoctors = async () => {
  const q = query(
    collection(db, COLLECTIONS.COMM_DOCTORS),
    where("active", "==", true),
    where("visibility", "==", "PUBLIC"),
    orderBy("name")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getDoctorsByTenant = async (tenantId) => {
  const q = query(
    collection(db, COLLECTIONS.SAAS_DOCTORS),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const updateDoctorStatus = async (doctorId, newStatus) => {
  // 1. Update saas_doctors
  await updateDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId), {
    status: newStatus,
  });

  // 2. Sync visibility to comm_doctors
  await updateDoc(doc(db, COLLECTIONS.COMM_DOCTORS, doctorId), {
    active: newStatus === "ACTIVE",
    visibility: newStatus === "ACTIVE" ? "PUBLIC" : "HIDDEN",
    _syncedAt: serverTimestamp(),
  });
};

export const updateDoctor = async (doctorId, updates) => {
  // 🔑 If password is being updated, handle Firebase Auth separately
  if (updates.password) {
    const auth = getAuth();
    // Note: Password updates should be done via useDoctorAuth.changePassword()
    // This is just for admin-initiated password resets
    console.warn(
      "Password updates via updateDoctor are deprecated. Use changePassword() instead."
    );
    // Remove password from Firestore updates (never store in Firestore)
    const { password, ...updatesWithoutPassword } = updates;
    updates = updatesWithoutPassword;
  }

  // 1. Update saas_doctors
  await updateDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // 2. Sync allowed fields to comm_doctors
  const publicUpdates = {};
  [
    "name",
    "specialization",
    "specialty",
    "bio",
    "photoUrl",
    "tenantId",
    "providerId",
    "clinicId",
    "clinicName",
    "tenantName",
    "city",
    "address",
    "workingDays",
    "timeSlots",
    "education",
    "languages",
    "yearsOfExperience",
    "licenseKey",
  ].forEach((f) => {
    if (updates[f] !== undefined) publicUpdates[f] = updates[f];
  });
  if (updates.specialization !== undefined) {
    const specB = resolveSpecialty(updates.specialization);
    publicUpdates.specialty = specB;
    publicUpdates.specialtyEn = specB.en || '';
    publicUpdates.specialtyKey = resolveSpecialtyKey(updates.specialization);
  }
  if (updates.name !== undefined) {
    const nameB = isBilingual(updates.name)
      ? updates.name
      : normalizeBilingual(updates.name);
    publicUpdates.name = nameB;
    publicUpdates.nameEn = nameB.en || '';
  }
  if (Object.keys(publicUpdates).length > 0) {
    publicUpdates._syncedAt = serverTimestamp();
    await updateDoc(
      doc(db, COLLECTIONS.COMM_DOCTORS, doctorId),
      publicUpdates
    );
  }
};

export const deleteDoctor = async (doctorId) => {
  // 1. Delete from saas_doctors
  await deleteDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId));

  // 2. Delete from comm_doctors
  await deleteDoc(doc(db, COLLECTIONS.COMM_DOCTORS, doctorId));
};

// ─── PATIENTS & APPOINTMENTS ────────────────────────────────────────────────
export const createPatient = async (patientData) => {
  const { phone, ...data } = patientData;
  await setDoc(doc(db, COLLECTIONS.COMM_PATIENTS, phone), {
    ...data,
    phone,
    synced: false,
    lastUpdated: serverTimestamp(),
  });
};

export const lookupPatient = async (phone) => {
  const ref = doc(db, COLLECTIONS.COMM_PATIENTS, phone);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
};

export const createAppointment = async (appointmentData) => {
  const ref = await addDoc(collection(db, COLLECTIONS.COMM_APPOINTMENTS), {
    ...appointmentData,
    status: "SCHEDULED",
    synced: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const getAppointmentsByPatient = async (
  patientPhone,
  tenantId = null
) => {
  let q = query(
    collection(db, COLLECTIONS.COMM_APPOINTMENTS),
    where("patientPhone", "==", patientPhone),
    orderBy("createdAt", "desc")
  );
  if (tenantId) {
    q = query(q, where("tenantId", "==", tenantId));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getUnsyncedAppointments = async ({
  licenseKey,
  tenantId,
  lastDoc = null,
  batchSize = 100,
}) => {
  let q = query(
    collection(db, COLLECTIONS.COMM_APPOINTMENTS),
    where("synced", "==", false),
    where("licenseKey", "==", licenseKey),
    orderBy("createdAt", "asc"),
    limit(batchSize)
  );
  if (tenantId) {
    q = query(q, where("tenantId", "==", tenantId));
  }
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  const snapshot = await getDocs(q);
  return {
    docs: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    lastDoc:
      snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : null,
    hasMore: snapshot.docs.length === batchSize,
  };
};

// ─── SYNC QUEUE ─────────────────────────────────────────────────────────────
export const queueSyncAppointment = async ({
  licenseKey,
  tenantId,
  appointmentId,
  patientPhone,
  doctorId,
}) => {
  await addDoc(collection(db, COLLECTIONS.SYNC_QUEUE), {
    licenseKey,
    tenantId,
    appointmentId,
    patientPhone,
    doctorId,
    status: "PENDING",
    retryCount: 0,
    createdAt: serverTimestamp(),
    nextRetry: null,
  });
};

export const getPendingSyncItems = async ({ licenseKey, batchSize = 20 }) => {
  const q = query(
    collection(db, COLLECTIONS.SYNC_QUEUE),
    where("licenseKey", "==", licenseKey),
    where("status", "in", ["PENDING", "FAILED"]),
    where("retryCount", "<", 5),
    orderBy("createdAt", "asc"),
    limit(batchSize)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const markSyncComplete = async (queueItemId) => {
  await deleteDoc(doc(db, COLLECTIONS.SYNC_QUEUE, queueItemId));
};

export const markSyncFailed = async (queueItemId, error, retryCount) => {
  await updateDoc(doc(db, COLLECTIONS.SYNC_QUEUE, queueItemId), {
    status: "FAILED",
    lastError: error,
    retryCount,
    nextRetry: serverTimestamp(),
  });
};

// ─── SERVER REGISTRATION ──────────────────────────────────────────────────
export const registerClinicServer = async ({
  macAddress,
  licenseKey,
  tunnelUrl,
  localIp,
  port,
  version,
}) => {
  await setDoc(doc(db, COLLECTIONS.SERVERS, macAddress), {
    macAddress,
    licenseKey,
    tunnelUrl,
    localIp,
    port,
    status: "ONLINE",
    lastSeen: serverTimestamp(),
    version,
    registeredAt: serverTimestamp(),
  });
};

export const updateServerHeartbeat = async (macAddress, updates) => {
  await updateDoc(doc(db, COLLECTIONS.SERVERS, macAddress), {
    ...updates,
    lastSeen: serverTimestamp(),
  });
};

export const getServerByLicense = async (licenseKey) => {
  const q = query(
    collection(db, COLLECTIONS.SERVERS),
    where("licenseKey", "==", licenseKey),
    where("status", "==", "ONLINE"),
    orderBy("lastSeen", "desc"),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

// ─── APP VERSIONS / UPDATE MANAGEMENT ────────────────────────────────────────

const APP_META = {
  dr:     { label: "Doctor Client",  icon: "🩺" },
  sec:    { label: "Secretary Client", icon: "📋" },
  server: { label: "Clinic Server",   icon: "🖥️" },
};

export const getAppVersions = async () => {
  const results = [];
  for (const [appId, meta] of Object.entries(APP_META)) {
    const snap = await getDoc(doc(db, COLLECTIONS.APP_VERSIONS, appId));
    results.push({
      appId,
      ...meta,
      ...(snap.exists() ? snap.data() : {}),
      exists: snap.exists(),
    });
  }
  return results;
};

export const publishVersion = async (appId, data) => {
  const docRef = doc(db, COLLECTIONS.APP_VERSIONS, appId);
  await setDoc(docRef, {
    version: data.version,
    buildNumber: Number(data.buildNumber) || 0,
    downloadUrl: data.downloadUrl || "",
    msiUrl: data.msiUrl || data.downloadUrl || "",
    releaseNotes: data.releaseNotes || "",
    releaseDate: data.releaseDate || new Date().toISOString().split("T")[0],
    minVersion: data.minVersion || "",
    forceUpdate: Boolean(data.forceUpdate),
    status: data.status || "published",
    fileSize: Number(data.fileSize) || 0,
    checksum: data.checksum || "",
    updatedAt: serverTimestamp(),
  });
};

export const unpublishVersion = async (appId) => {
  await updateDoc(doc(db, COLLECTIONS.APP_VERSIONS, appId), {
    status: "draft",
    updatedAt: serverTimestamp(),
  });
};

export const getReleaseHistory = async (appId, limitCount = 20) => {
  const q = query(
    collection(db, COLLECTIONS.APP_VERSIONS, appId, "releases"),
    orderBy("releaseDate", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const deleteRelease = async (appId, version) => {
  await deleteDoc(doc(db, COLLECTIONS.APP_VERSIONS, appId, "releases", version));
};

export const getClinicServers = async () => {
  const q = query(
    collection(db, COLLECTIONS.SERVERS),
    orderBy("lastSeen", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

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

export const getLowStockItems = async (tenantId) => {
  const q = query(
    collection(db, COLLECTIONS.INVENTORY_ITEMS),
    where("tenantId", "==", tenantId),
    where("status", "==", "ACTIVE"),
    where("currentStock", "<=", "reorderLevel") // intentional: client-side filter after query
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

async function recalcPOStatus(poId, tenantId) {
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
