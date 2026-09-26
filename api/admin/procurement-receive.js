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

  const { receiptId, tenantId } = req.body;
  if (!receiptId) return res.status(400).json({ error: 'receiptId is required' });
  if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

  try {
    const grSnap = await firestore.collection('goods_receipts').doc(receiptId).get();
    if (!grSnap.exists) return res.status(404).json({ error: 'Goods receipt not found' });
    const gr = grSnap.data();
    if (gr.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT goods receipt can be completed' });
    }

    const grItemsSnap = await firestore.collection('goods_receipt_items')
      .where('receiptId', '==', receiptId)
      .orderBy('lineNumber', 'asc')
      .get();
    const grItems = grItemsSnap.docs;

    const movementIds = [];
    for (const itemDoc of grItems) {
      const item = itemDoc.data();
      if (!item.inventoryItemId) continue;

      const itemSnap = await firestore.collection('inventory_items').doc(item.inventoryItemId).get();
      if (!itemSnap.exists) continue;
      const invItem = itemSnap.data();

      const stockBefore = invItem.currentStock || 0;
      const qty = item.quantityReceived;
      const stockAfter = stockBefore + qty;
      const oldAvgCost = invItem.averageCost || 0;
      const newAvgCost = (stockBefore + qty) > 0
        ? (stockBefore * oldAvgCost + qty * item.unitCost) / (stockBefore + qty)
        : item.unitCost;

      const batch = firestore.batch();

      const movementRef = firestore.collection('inventory_movements').doc();
      batch.set(movementRef, {
        tenantId,
        itemId: item.inventoryItemId,
        type: 'PURCHASE',
        quantity: qty,
        unitCost: item.unitCost || 0,
        totalCost: qty * (item.unitCost || 0),
        stockBefore,
        stockAfter,
        referenceType: 'goods_receipt',
        referenceId: receiptId,
        notes: `GR ${gr.receiptNumber} / ${item.itemName}`,
        createdBy: decoded.uid,
        createdAt: new Date(),
      });

      batch.update(firestore.collection('inventory_items').doc(item.inventoryItemId), {
        currentStock: stockAfter,
        averageCost: newAvgCost,
        updatedAt: new Date(),
      });

      batch.update(firestore.collection('goods_receipt_items').doc(itemDoc.id), {
        movementId: movementRef.id,
      });

      batch.update(firestore.collection('purchase_order_items').doc(item.poItemId), {
        quantityReceived: item.quantityNowReceived,
        quantityPending: item.quantityPending,
        updatedAt: new Date(),
      });

      await batch.commit();

      await firestore.collection('inventory_audit_log').add({
        tenantId,
        action: 'MOVEMENT',
        entityType: 'movement',
        entityId: movementRef.id,
        details: { itemId: item.inventoryItemId, type: 'PURCHASE', qty, stockBefore, stockAfter, newAvgCost, source: 'procurement' },
        performedBy: decoded.uid,
        createdAt: new Date(),
      });

      movementIds.push(movementRef.id);
    }

    await firestore.collection('goods_receipts').doc(receiptId).update({
      status: 'COMPLETED',
      movementsCreated: true,
      updatedAt: new Date(),
    });

    const poItemsSnap = await firestore.collection('purchase_order_items')
      .where('poId', '==', gr.poId)
      .get();
    const poItems = poItemsSnap.docs.map((d) => d.data());
    const allReceived = poItems.every((i) => i.quantityReceived >= i.quantityOrdered);
    const anyReceived = poItems.some((i) => i.quantityReceived > 0);
    let poStatus;
    if (allReceived) poStatus = 'RECEIVED';
    else if (anyReceived) poStatus = 'PARTIALLY_RECEIVED';
    else poStatus = 'ORDERED';
    const poUpdates = { status: poStatus, updatedAt: new Date() };
    if (poStatus === 'RECEIVED') poUpdates.receivedDate = new Date();
    await firestore.collection('purchase_orders').doc(gr.poId).update(poUpdates);

    await firestore.collection('procurement_audit_log').add({
      tenantId,
      action: 'GR_COMPLETED',
      entityType: 'goods_receipt',
      entityId: receiptId,
      details: { movementsCreated: movementIds.length },
      performedBy: decoded.uid,
      createdAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      receiptId,
      movementsCreated: movementIds.length,
      poStatus,
    });
  } catch (error) {
    console.error('Goods receipt completion failed:', error);
    return res.status(500).json({ error: 'Failed to complete goods receipt' });
  }
}
