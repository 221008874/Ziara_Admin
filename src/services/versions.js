import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, limit, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { COLLECTIONS } from "./core";

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

/**
 * Read the registered clinic servers.
 *
 * Served by /api/admin/servers (Admin SDK) rather than the client SDK: the
 * `servers` collection carries licenseKey/tunnelUrl and is deliberately
 * deny-by-default in Firestore rules, so a client read is (correctly) denied.
 * The handler is gated on the platform-admin claim and returns a projection.
 */
export const getClinicServers = async () => {
  const user = getAuth().currentUser;
  if (!user) {
    return [];
  }
  const token = await user.getIdToken();
  const response = await fetch("/api/admin/servers", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Failed to load clinic servers (HTTP ${response.status})`);
  }
  const data = await response.json();
  return Array.isArray(data?.servers) ? data.servers : [];
};