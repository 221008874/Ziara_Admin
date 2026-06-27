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

  const { tenantId, countDate, items } = req.body;

  if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
  if (!countDate) return res.status(400).json({ error: 'countDate is required (YYYY-MM-DD)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(countDate)) {
    return res.status(400).json({ error: 'countDate must be a valid date in YYYY-MM-DD format' });
  }
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

  try {
    const countedItems = [];
    const skippedItems = [];
    let totalDiscrepancy = 0;
    let adjustmentsCreated = 0;

    for (const entry of items) {
      const itemSnap = await firestore.collection('inventory_items').doc(entry.itemId).get();
      if (!itemSnap.exists) {
        skippedItems.push(entry.itemId);
        continue;
      }
      const item = itemSnap.data();
      const expectedQty = item.currentStock || 0;
      const actualQty = entry.actualQty;
      const difference = actualQty - expectedQty;
      countedItems.push({ itemId: entry.itemId, expectedQty, actualQty, difference, notes: entry.notes || '' });
      totalDiscrepancy += Math.abs(difference);
    }

    const stockCountRef = await firestore.collection('inventory_stock_counts').add({
      tenantId,
      countDate,
      status: 'COMPLETED',
      items: countedItems,
      totalDiscrepancy,
      reconciledAt: null,
      reconciledBy: null,
      createdBy: decoded.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (const ci of countedItems) {
      if (ci.difference === 0) continue;

      const adjustmentRef = await firestore.collection('inventory_adjustments').add({
        tenantId,
        itemId: ci.itemId,
        reason: 'MANUAL',
        expectedQty: ci.expectedQty,
        actualQty: ci.actualQty,
        difference: ci.difference,
        notes: ci.notes || `Stock count reconciliation: ${countDate}`,
        status: 'APPROVED',
        approvedBy: decoded.uid,
        approvedAt: new Date(),
        createdBy: decoded.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const batch = firestore.batch();
      const movementRef = firestore.collection('inventory_movements').doc();
      batch.set(movementRef, {
        tenantId,
        itemId: ci.itemId,
        type: 'ADJUSTMENT',
        quantity: ci.difference,
        unitCost: 0,
        totalCost: 0,
        stockBefore: ci.expectedQty,
        stockAfter: ci.actualQty,
        referenceType: 'stock_count',
        referenceId: stockCountRef.id,
        notes: ci.notes || `Stock count: ${countDate}`,
        createdBy: decoded.uid,
        createdAt: new Date(),
      });
      batch.update(firestore.collection('inventory_items').doc(ci.itemId), {
        currentStock: ci.actualQty,
        updatedAt: new Date(),
      });
      await batch.commit();

      await firestore.collection('inventory_audit_log').add({
        tenantId,
        action: 'ADJUSTMENT_APPROVED',
        entityType: 'adjustment',
        entityId: adjustmentRef.id,
        details: { movementId: movementRef.id, difference: ci.difference, reason: 'MANUAL', stockCountId: stockCountRef.id },
        performedBy: decoded.uid,
        createdAt: new Date(),
      });

      adjustmentsCreated++;
    }

    return res.status(200).json({
      success: true,
      stockCountId: stockCountRef.id,
      adjustmentsCreated,
      discrepanciesResolved: adjustmentsCreated,
      itemsCounted: countedItems.length,
      skippedItems: skippedItems.length > 0 ? skippedItems : undefined,
    });
  } catch (error) {
    console.error('Stock count submission failed:', error);
    return res.status(500).json({ error: 'Failed to submit stock count' });
  }
}
