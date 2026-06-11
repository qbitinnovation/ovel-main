import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import InventoryItem from '@/models/InventoryItem';
import InventoryTransaction from '@/models/InventoryTransaction';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevInventoryTransaction } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      const items = store.inventoryItems.filter((item) => item.isActive).sort((a, b) => a.name.localeCompare(b.name));
      const recentTransactions = store.inventoryTransactions
        .slice(0, 50)
        .map((txn) => ({
          ...txn,
          itemId: store.inventoryItems.find((item) => item._id === txn.itemId) || null,
          enteredBy: devUserRef(txn.enteredBy),
        }));
      return successResponse({ items, recentTransactions });
    }
    const items = await InventoryItem.find({ isActive: true }).sort({ name: 1 });
    // Get recent transactions
    const recentTransactions = await InventoryTransaction.find()
      .populate('itemId', 'name')
      .populate('enteredBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    return successResponse({ items, recentTransactions });
  } catch (error) {
    console.error('GET /api/inventory error:', error);
    return errorResponse('Failed to fetch inventory', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const body = await request.json();
    const { action } = body;
    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }
    const meta = getRequestMeta(request.headers);

    if (useDevStore) {
      const store = getDevStore();
      const now = new Date().toISOString();

      if (action === 'add-item') {
        const { name, unit, initialStock, lowStockThreshold } = body;
        if (!name?.trim()) return errorResponse('Item name is required');
        const existing = store.inventoryItems.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
        if (existing) return errorResponse('Item already exists');
        const openingStock = Number(initialStock || 0);
        if (openingStock < 0) return errorResponse('Opening stock cannot be negative');
        const item = {
          _id: createDevId('inventory'),
          name: name.trim(),
          unit: unit || 'pcs',
          currentStock: openingStock,
          lowStockThreshold: Number(lowStockThreshold ?? 5),
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        store.inventoryItems.unshift(item);
        if (openingStock > 0) {
          store.inventoryTransactions.unshift({
            _id: createDevId('txn'),
            itemId: item._id,
            type: 'restock',
            quantity: openingStock,
            amount: 0,
            supplier: 'Opening stock',
            date: now,
            enteredBy: session.user.id,
            createdAt: now,
          });
        }
        return successResponse(item, 'Item added', 201);
      }

      if (action === 'log-sale' || action === 'add-restock') {
        const { itemId, quantity, amount, supplier, date } = body;
        if (!itemId || !quantity) return errorResponse('Item and quantity required');
        const item = store.inventoryItems.find((entry) => entry._id === itemId);
        if (!item) return errorResponse('Item not found', 404);
        const qty = Number(quantity);
        if (qty <= 0) return errorResponse('Quantity must be greater than 0');
        if (action === 'log-sale' && item.currentStock < qty) return errorResponse(`Insufficient stock. Current: ${item.currentStock}`);
        item.currentStock += action === 'log-sale' ? -qty : qty;
        item.updatedAt = now;
        const txn: DevInventoryTransaction = {
          _id: createDevId('txn'),
          itemId,
          type: action === 'log-sale' ? 'sale' : 'restock',
          quantity: qty,
          amount: Number(amount || 0),
          supplier: supplier || '',
          date: date ? new Date(date).toISOString() : now,
          enteredBy: session.user.id,
          createdAt: now,
        };
        store.inventoryTransactions.unshift(txn);
        return successResponse({ item, transaction: { ...txn, itemId: item, enteredBy: devUserRef(session.user.id) } }, action === 'log-sale' ? 'Sale logged' : 'Restock logged');
      }

      if (action === 'set-threshold') {
        const { itemId, threshold } = body;
        const item = store.inventoryItems.find((entry) => entry._id === itemId);
        if (!item) return errorResponse('Item not found', 404);
        item.lowStockThreshold = Number(threshold || 0);
        item.updatedAt = now;
        return successResponse(item, 'Threshold updated');
      }

      return errorResponse('Invalid action');
    }

    if (action === 'add-item') {
      const { name, unit, initialStock, lowStockThreshold } = body;
      if (!name?.trim()) return errorResponse('Item name is required');
      const existing = await InventoryItem.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
      if (existing) return errorResponse('Item already exists');
      const openingStock = Number(initialStock || 0);
      if (openingStock < 0) return errorResponse('Opening stock cannot be negative');
      const item = await InventoryItem.create({ name: name.trim(), unit: unit || 'pcs', currentStock: openingStock, lowStockThreshold: lowStockThreshold ?? 5 });
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'add_inventory_item', module: 'inventory_sales', recordId: item._id, description: `Added inventory item "${item.name}"`, ...meta }, request.headers);
      return successResponse(item, 'Item added', 201);
    }

    if (action === 'log-sale') {
      const { itemId, quantity, amount, date } = body;
      if (!itemId || !quantity) return errorResponse('Item and quantity required');
      const item = await InventoryItem.findById(itemId);
      if (!item) return errorResponse('Item not found', 404);
      const qty = Number(quantity);
      if (qty <= 0) return errorResponse('Quantity must be greater than 0');
      if (item.currentStock < qty) return errorResponse(`Insufficient stock. Current: ${item.currentStock}`);
      item.currentStock -= qty;
      await item.save();
      const txn = await InventoryTransaction.create({ itemId, type: 'sale', quantity: qty, amount: amount || 0, date: date ? new Date(date) : new Date(), enteredBy: session.user.id });
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'log_sale', module: 'inventory_sales', recordId: txn._id, description: `Sold ${qty} ${item.unit} of ${item.name}. Stock: ${item.currentStock}`, ...meta }, request.headers);
      // Check threshold
      if (item.currentStock <= item.lowStockThreshold) {
        console.log(`⚠️ [ALERT] ${item.name} is below threshold! Stock: ${item.currentStock}, Threshold: ${item.lowStockThreshold}`);
      }
      return successResponse({ item, transaction: txn }, 'Sale logged');
    }

    if (action === 'add-restock') {
      const { itemId, quantity, amount, supplier, date } = body;
      if (!itemId || !quantity) return errorResponse('Item and quantity required');
      const item = await InventoryItem.findById(itemId);
      if (!item) return errorResponse('Item not found', 404);
      const qty = Number(quantity);
      if (qty <= 0) return errorResponse('Quantity must be greater than 0');
      item.currentStock += qty;
      await item.save();
      const txn = await InventoryTransaction.create({ itemId, type: 'restock', quantity: qty, amount: amount || 0, supplier: supplier || '', date: date ? new Date(date) : new Date(), enteredBy: session.user.id });
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'add_restock_entry', module: 'inventory_sales', recordId: txn._id, description: `Restocked ${qty} ${item.unit} of ${item.name}. Stock: ${item.currentStock}`, ...meta }, request.headers);
      return successResponse({ item, transaction: txn }, 'Restock logged');
    }

    if (action === 'set-threshold') {
      const { itemId, threshold } = body;
      if (!itemId) return errorResponse('Item ID required');
      const item = await InventoryItem.findById(itemId);
      if (!item) return errorResponse('Item not found', 404);
      const oldThreshold = item.lowStockThreshold;
      item.lowStockThreshold = threshold || 0;
      await item.save();
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'set_low_stock_threshold', module: 'inventory_sales', recordId: item._id, description: `Changed threshold for ${item.name}: ${oldThreshold} → ${threshold}`, oldValue: { threshold: oldThreshold }, newValue: { threshold }, ...meta }, request.headers);
      return successResponse(item, 'Threshold updated');
    }

    return errorResponse('Invalid action');
  } catch (error) {
    console.error('POST /api/inventory error:', error);
    return errorResponse('Failed to process', 500);
  }
}
