import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
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

const auth = getAuth();
const firestore = getFirestore();

const VALID_UNITS = ["piece", "box", "bottle", "pack", "kg", "liter", "meter", "strip", "vial", "other"];

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

  const { tenantId, items } = req.body;

  if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  const errors = [];
  const created = [];
  const batch = firestore.batch();
  let batchCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemErrors = [];

    if (!item.SKU || !/^[A-Za-z0-9\-]+$/.test(item.SKU)) {
      itemErrors.push('SKU must be alphanumeric with hyphens only');
    }
    if (!item.name?.en?.trim() || !item.name?.ar?.trim()) {
      itemErrors.push('name must have en and ar fields');
    } else if (!item.name?.en && !item.name?.ar) {
      itemErrors.push('name is required as { en, ar }');
    }
    if (!item.unit || !VALID_UNITS.includes(item.unit)) {
      itemErrors.push(`unit must be one of: ${VALID_UNITS.join(', ')}`);
    }
    if (!item.categoryId) {
      itemErrors.push('categoryId is required');
    }

    if (itemErrors.length > 0) {
      errors.push({ index: i, reason: itemErrors.join('; ') });
      continue;
    }

    const existing = await firestore.collection('inventory_items')
      .where('tenantId', '==', tenantId)
      .where('SKU', '==', item.SKU)
      .limit(1)
      .get();

    if (!existing.empty) {
      errors.push({ index: i, reason: `SKU "${item.SKU}" already exists for this tenant` });
      continue;
    }

    const itemRef = firestore.collection('inventory_items').doc();
    batch.set(itemRef, {
      tenantId,
      categoryId: item.categoryId,
      SKU: item.SKU,
      itemCode: item.itemCode || '',
      name: item.name,
      unit: item.unit,
      currentStock: 0,
      reorderLevel: item.reorderLevel || 0,
      averageCost: 0,
      sellingPrice: item.sellingPrice || 0,
      batchTracked: item.batchTracked || false,
      expiryTracked: item.expiryTracked || false,
      imageUrl: item.imageUrl || '',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    created.push({ index: i, id: itemRef.id, SKU: item.SKU });
    batchCount++;

    firestore.collection('inventory_audit_log').add({
      tenantId,
      action: 'ITEM_CREATED',
      entityType: 'item',
      entityId: itemRef.id,
      details: { SKU: item.SKU, name: item.name },
      performedBy: decoded.uid,
      createdAt: new Date(),
    });
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return res.status(200).json({
    created: created.length,
    errors,
    items: created,
  });
}
