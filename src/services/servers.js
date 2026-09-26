import { collection, getDocs, doc, setDoc, updateDoc, query, orderBy, serverTimestamp, where, limit } from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./core";

// ─── SERVER REGISTRATION ──────────────────────────────────────────────────
// ⚠️ DO NOT WIRE THESE UP.
//
// As of 2026-09-26 these three exports are dead code (nothing imports them), and
// the first two would NOT work and MUST NOT be enabled:
//
// 1. The deployed Firestore rules for `smartclinicadmin` have no `servers`
//    block, so these client-SDK writes hit the catch-all
//    `match /{document=**} { allow read, write: if false; }` and are DENIED.
// 2. Even if someone added a permissive rule to make them work, it would be a
//    credential-exfiltration hole. The SaaS relay (Community
//    `api/sync-to-local.js`) resolves a clinic by `servers/{mac}.tunnelUrl` and
//    then POSTs to that URL with the shared `X-Sync-Token` (= SYNC_SECRET).
//    A client-writable tunnelUrl lets anyone holding the project's *public*
//    Firebase web API key point it at a host they control and harvest that
//    secret.
//
// The correct owner of `servers/{mac}.tunnelUrl` is the clinic server itself
// (TunnelManager, Admin SDK, value from its own TUNNEL_URL config).
// See ZIARA_SAS/ziara-architecture-v2.md §8.
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
