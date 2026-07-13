import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
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

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);
    if (!decoded.admin && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const erpSyncUrl = process.env.ERP_SYNC_URL;
  const erpSyncSecret = process.env.ERP_SYNC_SECRET;

  if (!erpSyncUrl) {
    return res.status(200).json({ success: true, message: 'ERP sync URL not configured' });
  }

  try {
    const response = await fetch(`${erpSyncUrl}?reconcile=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${erpSyncSecret || ''}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      return res.status(502).json({ success: false, message: `ERP sync returned ${response.status}` });
    }
    const data = await response.json();
    return res.status(200).json({ success: true, message: 'ERP cache refreshed', data });
  } catch {
    return res.status(502).json({ success: false, message: 'ERP not reachable' });
  }
}
