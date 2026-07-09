import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { verifyAdminAuth } from '../../src/lib/auth-middleware';

if (!getApps().length) {
  try {
    const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    if (!base64Key || base64Key.length < 50) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 is missing or too short');
    }
    const decoded = Buffer.from(base64Key, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decoded);
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error('Service account JSON is missing required fields');
    }
    initializeApp({ credential: cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized (create-doctor-auth)');
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err.message);
  }
}

const auth = getAuth();

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyAdminAuth(req);
  } catch (err) {
    if (err.message === 'AUTH_REQUIRED') {
      return res.status(401).json({ error: 'Authorization required' });
    }
    if (err.message === 'ADMIN_REQUIRED') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email, password, uid } = req.body;
  const normalizedEmail = email?.toLowerCase().trim();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (!uid) {
    return res.status(400).json({ error: 'Doctor UID (saas_doctors ID) is required' });
  }

  try {
    const userRecord = await auth.createUser({
      email: normalizedEmail,
      password,
      emailVerified: false,
      disabled: false,
    });

    console.log('✅ Doctor auth account created:', userRecord.uid, 'for doctor:', uid);

    return res.status(200).json({
      success: true,
      firebaseUid: userRecord.uid,
    });
  } catch (error) {
    console.error('❌ Doctor auth creation failed:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'A doctor with this email already exists' });
    }
    if (error.code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'Password is too weak' });
    }
    return res.status(500).json({ error: 'Failed to create doctor account' });
  }
}
