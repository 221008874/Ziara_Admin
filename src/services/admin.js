import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, serverTimestamp, limit, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./core";
import { getAllTenants } from "./tenants";
import { getAllLicenses } from "./licenses";

const PLATFORM_ADMINS = "platform_admins";
const ERROR_LOGS = "error_logs";

export const getMetricsSnapshot = async () => {
  const tenants = await getAllTenants();
  const licenses = await getAllLicenses();
  const admins = await getPlatformAdmins();

  const active = tenants.filter(t => t.status === "ACTIVE").length;
  const pending = tenants.filter(t => t.status === "PENDING").length;
  const suspended = tenants.filter(t => t.status === "SUSPENDED" || t.status === "INACTIVE").length;

  const now = new Date();
  const expiringSoon = licenses.filter(l => {
    if (!l.expiryDate) return false;
    let expiry;
    if (l.expiryDate?.toDate) expiry = l.expiryDate.toDate();
    else if (typeof l.expiryDate === "string") expiry = new Date(l.expiryDate);
    else if (l.expiryDate instanceof Date) expiry = l.expiryDate;
    else return false;
    const diff = expiry - now;
    return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  const recentSignups = tenants
    .filter(t => t.createdAt?.toDate)
    .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
    .slice(0, 5)
    .map(t => ({ id: t.id, name: t.name, createdAt: t.createdAt.toDate(), status: t.status }));

  return {
    totalTenants: tenants.length,
    activeTenants: active,
    pendingTenants: pending,
    suspendedTenants: suspended,
    totalPlatformAdmins: admins.length,
    activeLicenses: licenses.filter(l => l.status === "ACTIVE" || !l.expired).length,
    expiringSoonLicenses: expiringSoon,
    totalLicenses: licenses.length,
    recentSignups,
  };
};

export const getPlatformAdmins = async () => {
  const q = query(
    collection(db, PLATFORM_ADMINS),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addPlatformAdmin = async (adminData) => {
  const { email, uid, ...data } = adminData;
  if (!email && !uid) throw new Error("Email or UID required");
  const id = uid || email;
  const existing = await getDoc(doc(db, PLATFORM_ADMINS, id));
  if (existing.exists()) throw new Error("Admin already exists");
  await setDoc(doc(db, PLATFORM_ADMINS, id), {
    email: email || "",
    uid: uid || "",
    ...data,
    role: "admin",
    createdAt: serverTimestamp(),
  });
  return id;
};

export const removePlatformAdmin = async (id) => {
  await deleteDoc(doc(db, PLATFORM_ADMINS, id));
};

export const getErrorLogs = async (filters = {}) => {
  const constraints = [];
  if (filters.severity) constraints.push(where("severity", "==", filters.severity));
  if (filters.tenantId) constraints.push(where("tenantId", "==", filters.tenantId));
  constraints.push(orderBy("createdAt", filters.order || "desc"));
  if (filters.limit) constraints.push(limit(filters.limit));
  const q = query(collection(db, ERROR_LOGS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
