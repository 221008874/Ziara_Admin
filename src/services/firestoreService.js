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
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

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
};

// ─── BILINGUAL FIELD NORMALIZER ─────────────────────────────────────────────
// Accepts raw value (string or {en, ar}) and always returns {en, ar}
function normalizeBilingual(raw, fallbackEn = "", fallbackAr = "") {
  if (isBilingual(raw)) return raw;
  if (typeof raw === "string") return createBilingual(raw, raw);
  return createBilingual(fallbackEn, fallbackAr);
}

// ─── PUBLIC-SAFE FIELD BUILDERS ─────────────────────────────────────────────
function buildPublicDoctor(data, doctorId) {
  const nameB = normalizeBilingual(data.name);
  const specialtyB = normalizeBilingual(data.specialization || data.specialty);
  return {
    name: nameB,
    nameEn: nameB.en || '',
    specialty: specialtyB,
    specialtyEn: specialtyB.en || '',
    bio: normalizeBilingual(data.bio),
    photoUrl: data.photoUrl || "",
    tenantId: data.tenantId || data.clinicId || "",
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
    _syncedAt: serverTimestamp(),
    _sourceId: doctorId,
  };
}

function buildPublicTenant(data, tenantId) {
  return {
    id: tenantId,
    name: normalizeBilingual(data.name || data.clinicName),
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
  await setDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), {
    ...data,
    licenseKey,
    status: "ACTIVE",
    expired: false,
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

// ─── TENANTS (SaaS + COMM dual-write) ─────────────────────────────────────
export const createTenant = async (tenantData) => {
  // 1. Write to saas_tenants
  const saasRef = await addDoc(collection(db, COLLECTIONS.SAAS_TENANTS), {
    ...tenantData,
    status: "ACTIVE",
    createdAt: serverTimestamp(),
  });

  // 2. Mirror to comm_tenants
  const publicTenant = buildPublicTenant(
    { ...tenantData, status: "ACTIVE" },
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

  // 3. Hide associated doctors in comm_doctors
  const doctorsQuery = query(
    collection(db, COLLECTIONS.COMM_DOCTORS),
    where("tenantId", "==", tenantId)
  );
  const doctorsSnap = await getDocs(doctorsQuery);
  for (const d of doctorsSnap.docs) {
    await updateDoc(d.ref, {
      active: false,
      visibility: "HIDDEN",
      _syncedAt: serverTimestamp(),
    });
  }
};

// ─── DOCTORS (SaaS + COMM dual-write) ─────────────────────────────────────
// 🔑 SINGLE createDoctor function with Firebase Auth integration
export const createDoctor = async (doctorData) => {
  let saasRef;
  let authUser = null;

  try {
    // 🔑 Extract password before storing in Firestore (never store passwords in Firestore)
    const { password, confirmPassword, ...doctorPublicData } = doctorData;

    // 1. Write to saas_doctors (internal admin data)
    saasRef = await addDoc(collection(db, COLLECTIONS.SAAS_DOCTORS), {
      ...doctorPublicData,
      status: "ACTIVE",
      createdAt: serverTimestamp(),
    });

    // 2. Create Firebase Auth account for doctor login (if password provided)
    if (doctorData.email && password) {
      const auth = getAuth();
      authUser = await createUserWithEmailAndPassword(
        auth,
        doctorData.email,
        password
      );

      // 3. Create mapping in comm_doctor_users with firstLogin flag
      await setDoc(
        doc(db, COLLECTIONS.COMM_DOCTOR_USERS, doctorData.email),
        {
          doctorId: saasRef.id,
          email: doctorData.email,
          firstLogin: true, // 🔑 CRITICAL: Flag for mandatory password change
          createdAt: serverTimestamp(),
        }
      );
    }

    // 4. Mirror to comm_doctors (public-safe, NO password field)
    const publicDoctor = buildPublicDoctor(
      { ...doctorPublicData, status: "ACTIVE" },
      saasRef.id
    );
    await setDoc(
      doc(db, COLLECTIONS.COMM_DOCTORS, saasRef.id),
      publicDoctor
    );

    // 5. Ensure tenant exists in comm_tenants
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
        });
      }
    }

    return saasRef.id;
  } catch (error) {
    // 🔥 Rollback: Clean up Auth user if Firestore write failed
    if (authUser?.user) {
      await authUser.user.delete().catch(console.error);
    }
    // Rollback: Delete from saas_doctors if comm write failed
    if (saasRef?.id) {
      await deleteDoc(
        doc(db, COLLECTIONS.SAAS_DOCTORS, saasRef.id)
      ).catch(console.error);
    }
    throw error;
  }
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
  ].forEach((f) => {
    if (updates[f] !== undefined) publicUpdates[f] = updates[f];
  });
  if (updates.specialization !== undefined) {
    const specB = isBilingual(updates.specialization)
      ? updates.specialization
      : normalizeBilingual(updates.specialization);
    publicUpdates.specialty = specB;
    publicUpdates.specialtyEn = specB.en || '';
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