// /api/admin/register-verify.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (same as register-request)
if (!getApps().length) {
  try {
    const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    const decoded = Buffer.from(base64Key, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decoded);
    initializeApp({ credential: cert(serviceAccount) });
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
  }
}

const db = getFirestore();
const auth = getAuth();

// Hash OTP (must match register-request.js exactly)
async function hashOtp(otp) {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp, fullName, password } = req.body;
  const normalizedEmail = email?.toLowerCase().trim();

  if (!normalizedEmail || !otp || !fullName || !password) {
    return res.status(400).json({ error: 'Email, OTP, full name, and password are required' });
  }

  try {
    // Get stored OTP data
    const otpDoc = await db.collection('saas_otp_requests').doc(normalizedEmail).get();
    
    if (!otpDoc.exists) {
      return res.status(400).json({ error: 'No verification request found. Please request a new code.' });
    }

    const otpData = otpDoc.data();
    
    // Check expiry
    if (new Date() > new Date(otpData.expiry)) {
      return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }

    // Check max attempts
    if (otpData.attempts >= 5) {
      return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
    }

    // Verify OTP hash
    const inputHash = await hashOtp(otp);
    if (inputHash !== otpData.otpHash) {
      // Increment attempts
      await db.collection('saas_otp_requests').doc(normalizedEmail).update({
        attempts: (otpData.attempts || 0) + 1
      });
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // OTP verified — create Firebase user
    const userRecord = await auth.createUser({
      email: normalizedEmail,
      password: password,
      displayName: fullName,
    });

    // Set admin claim
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });

    // Clean up OTP document
    await db.collection('saas_otp_requests').doc(normalizedEmail).delete();

    return res.status(200).json({ 
      success: true, 
      message: 'Admin account created successfully',
      uid: userRecord.uid 
    });

  } catch (error) {
    console.error('Verify error:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'This email is already registered' });
    }
    
    return res.status(500).json({ error: 'Failed to create account: ' + error.message });
  }
}