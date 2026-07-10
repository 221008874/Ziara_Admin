import { collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS, buildPublicTenant } from "./core";
import { createLicense } from "./licenses";

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
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = writeBatch(db);
      docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
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
