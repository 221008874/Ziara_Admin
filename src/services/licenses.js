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
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, docId), {
    status: newStatus,
  });
};

export const updateLicenseExpiry = async (licenseKey, newExpiryDate) => {
  const isPast = new Date(newExpiryDate) < new Date();
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), {
    expiryDate: newExpiryDate,
    status: isPast ? "EXPIRED" : "ACTIVE",
    expired: isPast,
  });
};

export const updateLicenseOnlineBooking = async (licenseKey, enabled) => {
  await updateDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey), {
    onlineBooking: Boolean(enabled),
  });
};
