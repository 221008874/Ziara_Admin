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
