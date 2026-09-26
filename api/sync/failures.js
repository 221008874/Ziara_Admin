import { getDb, COMMUNITY } from '../_lib/firebase-admin';
import { verifyAdminAuth } from '../../src/lib/auth-middleware';

const db = getDb(COMMUNITY);

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

  // Verification is pinned to the Community project (where panel admins sign in).
  // See src/lib/auth-middleware.js.
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
