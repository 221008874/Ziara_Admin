import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { isBilingual } from "../lib/i18n";
import { debug } from "../lib/debug";
import { COLLECTIONS, normalizeBilingual, resolveSpecialty, resolveSpecialtyKey, buildPublicDoctor } from "./core";
import { createLicense } from "./licenses";

// ─── DOCTORS (SaaS + COMM dual-write) ─────────────────────────────────────
export const createDoctor = async (doctorData) => {
  const { password, licenseKey, ...doctorPublicData } = doctorData;

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

  // If doctor belongs to tenant, validate tenant exists in saas_tenants
  if (doctorPublicData.tenantId) {
    const tenantSnap = await getDoc(doc(db, COLLECTIONS.SAAS_TENANTS, doctorPublicData.tenantId));
    if (!tenantSnap.exists()) {
      throw new Error(`Tenant "${doctorPublicData.tenantId}" not found. Create the tenant first.`);
    }
  }

  // If doctor belongs to tenant, validate tenant's license exists
  if (licenseKey && doctorPublicData.tenantId) {
    const licSnap = await getDoc(doc(db, COLLECTIONS.SAAS_LICENSES, licenseKey));
    if (!licSnap.exists()) {
      throw new Error(`License key "${licenseKey}" not found. Create the tenant license first.`);
    }
  }

  // Enforce email uniqueness across doctors (comm_doctor_users is keyed by email)
  if (doctorData.email) {
    const existingUser = await getDoc(
      doc(db, COLLECTIONS.COMM_DOCTOR_USERS, doctorData.email.toLowerCase())
    );
    if (existingUser.exists()) {
      throw new Error(`A doctor with email "${doctorData.email}" already exists`);
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
      console.error("Auth creation failed, cleaning up Firestore records:", authErr);
      await deleteDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId)).catch(() => {});
      if (doctorData.email) {
        await deleteDoc(
          doc(db, COLLECTIONS.COMM_DOCTOR_USERS, doctorData.email.toLowerCase())
        ).catch(() => {});
      }
      await deleteDoc(doc(db, COLLECTIONS.COMM_DOCTORS, doctorId)).catch(() => {});
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
        debug.error("TenantSync", e)
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
    where("tenantId", "==", tenantId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const updateDoctorStatus = async (doctorId, newStatus) => {
  // 1. Update saas_doctors
  await updateDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId), {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  // 2. Sync visibility to comm_doctors
  await updateDoc(doc(db, COLLECTIONS.COMM_DOCTORS, doctorId), {
    active: newStatus === "ACTIVE",
    visibility: newStatus === "ACTIVE" ? "PUBLIC" : "HIDDEN",
    _syncedAt: serverTimestamp(),
  });
};

export const updateDoctor = async (doctorId, updates) => {
  const password = updates.password;
  if (password) {
    const { password: _password, ...rest } = updates;
    updates = rest;
  }

  const currentSnap = await getDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId));
  if (!currentSnap.exists()) throw new Error("Doctor not found");
  const current = currentSnap.data();

  // Validate tenantId exists if being changed
  if (updates.tenantId) {
    const tenantSnap = await getDoc(doc(db, COLLECTIONS.SAAS_TENANTS, updates.tenantId));
    if (!tenantSnap.exists()) {
      throw new Error(`Tenant "${updates.tenantId}" not found. Create the tenant first.`);
    }
  }

  // Re-key comm_doctor_users when email changes (preserve firebaseUid)
  const newEmail = updates.email ? updates.email.toLowerCase() : null;
  const oldEmail = (current.email || "").toLowerCase();
  if (newEmail && newEmail !== oldEmail) {
    const existingMap = await getDoc(doc(db, COLLECTIONS.COMM_DOCTOR_USERS, newEmail));
    if (existingMap.exists() && existingMap.data().doctorId !== doctorId) {
      throw new Error(`A doctor with email "${updates.email}" already exists`);
    }
    const oldMap = oldEmail ? await getDoc(doc(db, COLLECTIONS.COMM_DOCTOR_USERS, oldEmail)) : null;
    const firebaseUid = oldMap?.exists() ? oldMap.data().firebaseUid : "";
    if (oldEmail) {
      await deleteDoc(doc(db, COLLECTIONS.COMM_DOCTOR_USERS, oldEmail)).catch(() => {});
    }
    await setDoc(doc(db, COLLECTIONS.COMM_DOCTOR_USERS, newEmail), {
      doctorId,
      email: newEmail,
      firebaseUid,
      firstLogin: false,
      updatedAt: serverTimestamp(),
    });
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

  // 3. Sync email/password to the Firebase Auth account
  const emailChanged = newEmail && newEmail !== oldEmail;
  if (password || emailChanged) {
    try {
      const authEmail = newEmail || oldEmail;
      const mapSnap = await getDoc(doc(db, COLLECTIONS.COMM_DOCTOR_USERS, authEmail));
      const firebaseUid = mapSnap.exists() ? mapSnap.data().firebaseUid : "";
      if (!firebaseUid) {
        throw new Error("Doctor has no linked auth account");
      }
      const apiBase = import.meta.env.VITE_API_BASE || "";
      const res = await fetch(`${apiBase}/api/admin/reset-doctor-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: firebaseUid,
          email: emailChanged ? newEmail : undefined,
          password: password || undefined,
        }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || "Failed to update doctor account");
      }
    } catch (pwErr) {
      console.error("Doctor auth update failed:", pwErr);
      throw pwErr;
    }
  }
};

export const deleteDoctor = async (doctorId) => {
  // 1. Delete from saas_doctors
  await deleteDoc(doc(db, COLLECTIONS.SAAS_DOCTORS, doctorId));

  // 2. Delete from comm_doctors
  await deleteDoc(doc(db, COLLECTIONS.COMM_DOCTORS, doctorId));

  // 3. Clean up comm_doctor_users mapping
  const userMapQuery = query(
    collection(db, COLLECTIONS.COMM_DOCTOR_USERS),
    where("doctorId", "==", doctorId)
  );
  const userMaps = await getDocs(userMapQuery);
  for (const u of userMaps.docs) {
    await deleteDoc(u.ref);
  }
};
