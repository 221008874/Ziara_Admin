import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// 🔹 Initialize Firebase Admin (singleton)
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString()
    );
    initializeApp({ credential: cert(serviceAccount) });
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
  }
}

const db = getFirestore();
const auth = getAuth();

// 🔒 Hash OTP for comparison
async function hashOtp(otp) {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp, fullName } = req.body;
  if (!email || !otp || !fullName) {
    return res.status(400).json({ error: 'Email, OTP, and full name are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const otpHash = await hashOtp(otp);

  try {
    const otpRef = db.collection('saas_otp_requests').doc(normalizedEmail);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      return res.status(400).json({ error: 'No verification request found. Please request a new code.' });
    }

    const otpData = otpSnap.data();

    // Check expiry
    if (new Date() > new Date(otpData.expiry)) {
      await otpRef.delete();
      return res.status(400).json({ error: 'Verification code expired. Request a new one.' });
    }

    // Check attempts
    if (otpData.attempts >= 5) {
      await otpRef.delete();
      return res.status(400).json({ error: 'Too many attempts. Request a new code.' });
    }

    // Verify OTP
    if (otpData.otpHash !== otpHash) {
      await otpRef.update({ attempts: otpData.attempts + 1 });
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // ✅ Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: normalizedEmail,
      displayName: fullName,
      emailVerified: false,
      disabled: false,
    });

    // 🔑 Set admin custom claim
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });

    // 🧹 Clean up OTP
    await otpRef.delete();

    return res.status(200).json({
      success: true,
      message: 'Admin account created successfully! Please sign in.',
      uid: userRecord.uid,
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }
    return res.status(500).json({ error: 'Registration failed' });
  }
}