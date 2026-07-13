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
    console.log('✅ Firebase Admin initialized (reset-doctor-password)');
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

  const { uid, email, password } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'Doctor UID (firebaseUid) is required' });
  }
  if (!email && !password) {
    return res.status(400).json({ error: 'Email or password is required' });
  }
  if (password && password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const update = {};
    if (email) update.email = email.toLowerCase().trim();
    if (password) update.password = password;
    await auth.updateUser(uid, update);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Doctor auth update failed:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(400).json({ error: 'Doctor auth account not found' });
    }
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'That email is already in use' });
    }
    if (error.code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'Password is too weak' });
    }
    return res.status(500).json({ error: 'Failed to update doctor account' });
  }
}
