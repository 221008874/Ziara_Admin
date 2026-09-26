import { verifyAdminAuth } from '../../src/lib/auth-middleware';
import { getAdminAuth, COMMUNITY } from '../_lib/firebase-admin';

const auth = getAdminAuth(COMMUNITY);

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

    // Bind the doctor's UID so the dashboard can be authorized via the
    // `doctor_id` token claim (doctors are not in any tenant staffUids array).
    await auth.setCustomUserClaims(userRecord.uid, { doctor_id: uid });

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
