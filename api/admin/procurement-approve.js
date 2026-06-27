import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
const firestore = getFirestore();

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

  let decoded;
  try {
    decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!decoded.admin) {
    return res.status(403).json({ error: 'Admin access required' });
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
