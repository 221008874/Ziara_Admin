import nodemailer from 'nodemailer';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ─── Initialize Firebase Admin ─────────────────────────────────────────────

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
    console.log('✅ Firebase Admin initialized');
    
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err.message);
  }
}

const db = getFirestore();
const auth = getAuth();

// ─── Your fixed owner email ────────────────────────────────────────────────
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'bedoboda22222@gmail.com';

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashOtp(otp) {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Main Handler ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  const userEmail = email?.toLowerCase().trim();

  if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const clientIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();

  async function sha256(value) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(value));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  try {
    // Rate limit: per-email cooldown (3 min) to prevent OTP spam
    const existingOtp = await db.collection('saas_otp_requests').doc(userEmail).get();
    if (existingOtp.exists) {
      const requestedAt = new Date(existingOtp.data().requestedAt).getTime();
      if (now - requestedAt < 3 * 60 * 1000) {
        return res
          .status(429)
          .json({ error: 'Too many requests. Please wait before requesting another code.' });
      }
    }

    // Rate limit: per-IP global cooldown (1 min) to prevent owner email bombing
    const ipKey = await sha256(clientIp);
    const rlDoc = await db.collection('saas_rate_limits').doc(ipKey).get();
    if (rlDoc.exists) {
      const lastRequest = new Date(rlDoc.data().lastRequest).getTime();
      if (now - lastRequest < 60 * 1000) {
        return res
          .status(429)
          .json({ error: 'Too many requests. Please try again later.' });
      }
    }
    await db
      .collection('saas_rate_limits')
      .doc(ipKey)
      .set({ lastRequest: new Date().toISOString(), ipHash: ipKey });

    // Continue with OTP generation
    // Check if already an admin
    try {
      const user = await auth.getUserByEmail(userEmail);
      if (user.customClaims?.admin === true) {
        return res.status(400).json({ error: 'This email is already registered as an admin' });
      }
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    // Generate & store OTP keyed by USER'S email
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.collection('saas_otp_requests').doc(userEmail).set({
      otpHash,
      expiry,
      requestedAt: new Date().toISOString(),
      attempts: 0,
    });

    // Send OTP to OWNER EMAIL only
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Smart Clinic Admin" <${process.env.GMAIL_USER}>`,
      to: OWNER_EMAIL,  // ← ALWAYS your email
      subject: `🔐 New Admin Registration - ${userEmail}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0fb8a6; text-align: center;">Smart Clinic Admin</h2>
          <p><strong>New registration request from:</strong></p>
          <p>Email: <strong>${userEmail}</strong></p>
          <p>Password length: <strong>${password?.length || 0} chars</strong></p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="background: #0fb8a6; color: white; padding: 12px 24px; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</span>
          </div>
          <p>This code expires in <strong>10 minutes</strong>. Forward to ${userEmail} to approve.</p>
          <p style="color: #666; font-size: 12px;">If you didn't expect this, ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Verification request sent to administrator' 
    });

  } catch (error) {
    console.error('OTP request error:', error);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
}