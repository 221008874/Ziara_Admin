import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  if (base64Key && base64Key.length >= 50) {
    const decoded = Buffer.from(base64Key, 'base64').toString('utf-8');
    initializeApp({ credential: cert(JSON.parse(decoded)) });
  }
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const { getAuth } = await import('firebase-admin/auth');
    const token = authHeader.split('Bearer ')[1];
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.admin && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const type = req.query.type;

    let query = db.collection('sync_failures').orderBy('createdAt', 'desc').limit(limit);
    if (type) {
      query = query.where('type', '==', type);
    }

    const snap = await query.get();
    const failures = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
    }));

    return res.status(200).json({ failures, total: failures.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
