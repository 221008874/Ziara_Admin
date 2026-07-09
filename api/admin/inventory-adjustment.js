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
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
  }
}

const firestore = getFirestore();

const VALID_REASONS = ["DAMAGE", "LOSS", "FOUND", "EXPIRY", "MANUAL"];

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

  const { tenantId, itemId, reason, actualQty, notes } = req.body;

  if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
  if (!itemId) return res.status(400).json({ error: 'itemId is required' });
  if (!reason || !VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
  }
  if (actualQty === undefined || actualQty === null || typeof actualQty !== 'number') {
    return res.status(400).json({ error: 'actualQty must be a number' });
  }

  try {
    const itemSnap = await firestore.collection('inventory_items').doc(itemId).get();
    if (!itemSnap.exists) return res.status(404).json({ error: 'Item not found' });
    const item = itemSnap.data();
    const expectedQty = item.currentStock || 0;
    const difference = actualQty - expectedQty;

    const adjustmentRef = await firestore.collection('inventory_adjustments').add({
      tenantId,
      itemId,
      reason,
      expectedQty,
      actualQty,
      difference,
      notes: notes || '',
      status: 'APPROVED',
      approvedBy: decoded.uid,
      approvedAt: new Date(),
      createdBy: decoded.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const stockBefore = expectedQty;
    const stockAfter = actualQty;

    const batch = firestore.batch();

    const movementRef = firestore.collection('inventory_movements').doc();
    batch.set(movementRef, {
      tenantId,
      itemId,
      type: 'ADJUSTMENT',
      quantity: difference,
      unitCost: 0,
      totalCost: 0,
      stockBefore,
      stockAfter,
      referenceType: 'adjustment',
      referenceId: adjustmentRef.id,
      notes: notes || `Adjustment: ${reason}`,
      createdBy: decoded.uid,
      createdAt: new Date(),
    });

    batch.update(firestore.collection('inventory_items').doc(itemId), {
      currentStock: stockAfter,
      updatedAt: new Date(),
    });

    await batch.commit();

    await firestore.collection('inventory_audit_log').add({
      tenantId,
      action: 'ADJUSTMENT_APPROVED',
      entityType: 'adjustment',
      entityId: adjustmentRef.id,
      details: { movementId: movementRef.id, difference, reason },
      performedBy: decoded.uid,
      createdAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      adjustmentId: adjustmentRef.id,
      movementId: movementRef.id,
      difference,
    });
  } catch (error) {
    console.error('Inventory adjustment failed:', error);
    return res.status(500).json({ error: 'Failed to process adjustment' });
  }
}
