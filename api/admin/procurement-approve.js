import { getDb, ERP } from '../_lib/firebase-admin';
import { verifyAdminAuth } from '../../src/lib/auth-middleware';
const firestore = getDb(ERP);

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

  // Verification is pinned to the Community project (where panel admins sign in);
  // the data below lives in the ERP project. See src/lib/auth-middleware.js.
  let decoded;
  try {
    decoded = await verifyAdminAuth(req);
  } catch (err) {
    if (err.message === 'AUTH_REQUIRED') {
      return res.status(401).json({ error: 'Authorization required' });
    }
    if (err.message === 'ADMIN_REQUIRED') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { poId, tenantId } = req.body;
  if (!poId) return res.status(400).json({ error: 'poId is required' });
  if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

  try {
    const poSnap = await firestore.collection('purchase_orders').doc(poId).get();
    if (!poSnap.exists) return res.status(404).json({ error: 'PO not found' });
    const po = poSnap.data();
    if (po.status !== 'SUBMITTED') {
      return res.status(400).json({ error: `Cannot approve PO in status "${po.status}"` });
    }

    await firestore.collection('purchase_orders').doc(poId).update({
      status: 'APPROVED',
      approvedBy: decoded.uid,
      approvedAt: new Date(),
      updatedAt: new Date(),
    });

    await firestore.collection('procurement_audit_log').add({
      tenantId,
      action: 'PO_APPROVED',
      entityType: 'purchase_order',
      entityId: poId,
      details: {},
      performedBy: decoded.uid,
      createdAt: new Date(),
    });

    return res.status(200).json({ success: true, status: 'APPROVED' });
  } catch (error) {
    console.error('PO approval failed:', error);
    return res.status(500).json({ error: 'Failed to approve PO' });
  }
}
