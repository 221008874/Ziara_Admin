import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
    console.log('✅ Firebase Admin initialized (servers)');
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err.message);
  }
}

const db = getFirestore();

// `servers/{mac}` carries licenseKey and tunnelUrl. It stays deny-by-default in
// Firestore rules (the relay POSTs the shared X-Sync-Token to whatever
// tunnelUrl says, so it must never be client-writable), which means the admin
// panel cannot read it with the client SDK. This handler serves the read with
// the Admin SDK instead, behind the platform-admin claim, and returns an
// explicit projection rather than the raw document.
//
// `tunnelUrl` is deliberately NOT returned: it is a credential-adjacent routing
// value and the admin UI does not display it.
const PROJECTION = [
  'macAddress',
  'hostname',
  'licenseKey',
  'localIp',
  'ipAddress',
  'port',
  'status',
  'version',
  'lastSeen',
  'registeredAt',
];

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

  try {
    const snap = await db.collection('servers').get();
    const servers = snap.docs.map((doc) => {
      const data = doc.data() || {};
      const row = { id: doc.id };
      for (const key of PROJECTION) {
        if (data[key] !== undefined) row[key] = data[key];
      }
      // The UI calls lastSeen.toDate() when it is a Firestore Timestamp, but a
      // plain ISO string is friendlier over JSON. Normalise to ISO either way.
      if (row.lastSeen && typeof row.lastSeen.toDate === 'function') {
        row.lastSeen = row.lastSeen.toDate().toISOString();
      }
      return row;
    });

    // The client SDK used to do `orderBy('lastSeen','desc')`. Firestore does not
    // guarantee order for a plain `get()`, so sort here to keep the table order
    // stable. Offline/never-seen servers go last.
    const toMillis = (v) => {
      if (!v) return -Infinity;
      const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
      const ms = d instanceof Date ? d.getTime() : NaN;
      return Number.isNaN(ms) ? -Infinity : ms;
    };
    servers.sort((a, b) => toMillis(b.lastSeen) - toMillis(a.lastSeen));

    return res.status(200).json({ servers, total: servers.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
