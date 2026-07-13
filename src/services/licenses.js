import { collection, getDocs, doc, setDoc, updateDoc, query, orderBy, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./core";

// ─── LICENSES ───────────────────────────────────────────────────────────────
export const createLicense = async (licenseData) => {
  const { licenseKey, ...data } = licenseData;
  // Check uniqueness first
  const existing = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
  if (existing.exists()) {
    throw new Error(`License key "${licenseKey}" already exists`);
  }
  const isPast = data.expiryDate ? new Date(data.expiryDate) < new Date() : false;
  await setDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), {
    ...data,
    licenseKey,
    category: data.category || "doctor",
    status: isPast ? "EXPIRED" : data.status || "ACTIVE",
    expired: isPast,
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
  const snap = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, docId));
  const current = snap.data();
  const updates = { status: newStatus, updatedAt: serverTimestamp() };
  if (current?.expiryDate) {
    updates.expired = new Date(current.expiryDate) < new Date();
  }
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, docId), updates);
};

export const updateLicenseExpiry = async (licenseKey, newExpiryDate) => {
  const snap = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
  const current = snap.data();
  const isPast = new Date(newExpiryDate) < new Date();
  const updates = {
    expiryDate: newExpiryDate,
    expired: isPast,
  };
  if (isPast) {
    updates.status = "EXPIRED";
  } else if (current?.status === "EXPIRED") {
    updates.status = "ACTIVE";
  }
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), updates);
};

export const updateLicenseOnlineBooking = async (licenseKey, enabled) => {
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), {
    onlineBooking: Boolean(enabled),
    updatedAt: serverTimestamp(),
  });
};

export const updateLicense = async (licenseKey, updates) => {
  const snap = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
  const current = snap.data();
  const allowed = ["category", "doctorName", "phone", "onlineBooking", "expiryDate"];
  const safe = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) safe[key] = updates[key];
  }
  if (updates.expiryDate !== undefined) {
    const isPast = new Date(updates.expiryDate) < new Date();
    safe.expired = isPast;
    if (isPast) safe.status = "EXPIRED";
    else if (current?.status === "EXPIRED") safe.status = "ACTIVE";
  }
  safe.updatedAt = serverTimestamp();
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), safe);
};
