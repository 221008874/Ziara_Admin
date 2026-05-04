import nodemailer from 'nodemailer';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// 🔹 Initialize Firebase Admin (singleton for serverless)
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

// 🔐 Generate secure 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 🔒 Hash OTP with SHA-256 (never store plaintext)
async function hashOtp(otp) {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if already an admin
    try {
      const user = await auth.getUserByEmail(normalizedEmail);
      if (user.customClaims?.admin === true) {
        return res.status(400).json({ error: 'This email is already registered as an admin' });
      }
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    // Generate & store OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.collection('saas_otp_requests').doc(normalizedEmail).set({
      otpHash,
      expiry,
      requestedAt: new Date().toISOString(),
      attempts: 0,
    });

    // Send email
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
      to: normalizedEmail,
      subject: '🔐 Your Admin Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0fb8a6; text-align: center;">Smart Clinic Admin</h2>
          <p>You requested verification to register as a Smart Clinic admin.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="background: #0fb8a6; color: white; padding: 12px 24px; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</span>
          </div>
          <p>This code expires in <strong>10 minutes</strong>. Max 5 attempts allowed.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true, message: 'Verification code sent to your email' });

  } catch (error) {
    console.error('OTP request error:', error);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
}