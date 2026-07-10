import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, limit, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./core";

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
  const delayMs = Math.min(5 * 60 * 1000 * Math.pow(2, retryCount || 0), 24 * 60 * 60 * 1000);
  await updateDoc(doc(db, COLLECTIONS.SYNC_QUEUE, queueItemId), {
    status: "FAILED",
    lastError: error,
    retryCount: (retryCount || 0) + 1,
    nextRetry: Timestamp.fromMillis(Date.now() + delayMs),
  });
};
