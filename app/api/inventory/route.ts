import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import InventoryItem from '@/models/InventoryItem';
import InventoryTransaction from '@/models/InventoryTransaction';
import User from '@/models/User';
import Booking from '@/models/Booking';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevInventoryTransaction } from '@/lib/dev-store';
import { checkPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'inventory_sales', 'view_sales');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    try {
      await dbConnect();
      
      // Prevent tree-shaking of these models which are required for populate()
      if (!User || !Booking) console.log('Models loaded');
      
      const items = await InventoryItem.find({ isActive: true }).sort({ name: 1 });
      // Get recent transactions
      const recentTransactions = await InventoryTransaction.find()
        .populate('itemId', 'name')
        .populate('enteredBy', 'name')
        .populate({
          path: 'bookingId',
          select: 'customerName contactNumber paymentStatus bookingStatus expectedAmount totalPaid'
        })
        .sort({ createdAt: -1 })
        .limit(50);
      return successResponse({ items, recentTransactions });
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
          bookingId: txn.bookingId ? (store.bookings.find((b) => b._id === txn.bookingId) || null) : null,
        }));
      return successResponse({ items, recentTransactions });
    }
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

    let permissionAction = '';
    if (action === 'log-sale') permissionAction = 'create_sale';
    else if (action === 'add-item') permissionAction = 'add_item';
    else if (action === 'add-restock') permissionAction = 'add_restock';
    else if (action === 'set-threshold') permissionAction = 'add_restock';
    else if (action === 'delete-item') permissionAction = 'delete_item';

    if (permissionAction) {
      const permission = await checkPermission(session.user.id, 'inventory_sales', permissionAction);
      if (!permission.allowed) return errorResponse('Forbidden', 403);
    }

    // Sanitize user ID to prevent Mongoose CastErrors with legacy/cached session IDs
    const userId = /^[0-9a-fA-F]{24}$/.test(session.user.id)
      ? session.user.id
      : '000000000000000000000001';

    if (!useDevStore) {
      try {
        if (action === 'add-item') {
          const { name, unit, unitPrice, initialStock, lowStockThreshold } = body;
          if (!name?.trim()) return errorResponse('Item name is required');
          const existing = await InventoryItem.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
          if (existing) return errorResponse('Item already exists');
          const price = Number(unitPrice || 0);
          if (price < 0) return errorResponse('Price cannot be negative');
          const openingStock = Number(initialStock || 0);
          if (openingStock < 0) return errorResponse('Opening stock cannot be negative');
          const item = await InventoryItem.create({ name: name.trim(), unit: unit || 'pcs', unitPrice: price, currentStock: openingStock, lowStockThreshold: lowStockThreshold ?? 5 });
          await auditAction({ userId, userName: session.user.name || '', userType: session.user.userType, action: 'add_inventory_item', module: 'inventory_sales', recordId: item._id, description: `Added inventory item "${item.name}"`, ...meta }, request.headers);
          return successResponse(item, 'Item added', 201);
        }

        if (action === 'log-sale') {
          const { itemId, quantity, amount, date, customerName, customerContact } = body;
          if (!itemId || !quantity) return errorResponse('Item and quantity required');
          const item = await InventoryItem.findById(itemId);
          if (!item) return errorResponse('Item not found', 404);
          const qty = Number(quantity);
          if (qty <= 0) return errorResponse('Quantity must be greater than 0');
          if (item.currentStock < qty) return errorResponse(`Insufficient stock. Current: ${item.currentStock}`);
          item.currentStock -= qty;
          await item.save();
          const txn = await InventoryTransaction.create({ itemId, type: 'sale', quantity: qty, amount: amount || 0, date: date ? new Date(date) : new Date(), enteredBy: userId, customerName: customerName || '', customerContact: customerContact || '' });
          await auditAction({ userId, userName: session.user.name || '', userType: session.user.userType, action: 'log_sale', module: 'inventory_sales', recordId: txn._id, description: `Sold ${qty} ${item.unit} of ${item.name}. Stock: ${item.currentStock}`, ...meta }, request.headers);
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
          const txn = await InventoryTransaction.create({ itemId, type: 'restock', quantity: qty, amount: amount || 0, supplier: supplier || '', date: date ? new Date(date) : new Date(), enteredBy: userId });
          await auditAction({ userId, userName: session.user.name || '', userType: session.user.userType, action: 'add_restock_entry', module: 'inventory_sales', recordId: txn._id, description: `Restocked ${qty} ${item.unit} of ${item.name}. Stock: ${item.currentStock}`, ...meta }, request.headers);
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
          await auditAction({ userId, userName: session.user.name || '', userType: session.user.userType, action: 'set_low_stock_threshold', module: 'inventory_sales', recordId: item._id, description: `Changed threshold for ${item.name}: ${oldThreshold} → ${threshold}`, oldValue: { threshold: oldThreshold }, newValue: { threshold }, ...meta }, request.headers);
          return successResponse(item, 'Threshold updated');
        }

        if (action === 'delete-item') {
          const { itemId } = body;
          if (!itemId) return errorResponse('Item ID required');
          const item = await InventoryItem.findById(itemId);
          if (!item) return errorResponse('Item not found', 404);
          item.isActive = false;
          await item.save();
          await auditAction({ userId, userName: session.user.name || '', userType: session.user.userType, action: 'delete_inventory_item', module: 'inventory_sales', recordId: item._id, description: `Deleted inventory item "${item.name}"`, ...meta }, request.headers);
          return successResponse(null, 'Item deleted successfully');
        }

        return errorResponse('Invalid action');
      } catch (error) {
        if (!isDevFallbackEnabled()) throw error;
        useDevStore = true; // MongoDB error: fallback to dev store
      }
    }

    if (useDevStore) {
      const store = getDevStore();
      const now = new Date().toISOString();

      if (action === 'add-item') {
        const { name, unit, unitPrice, initialStock, lowStockThreshold } = body;
        if (!name?.trim()) return errorResponse('Item name is required');
        const existing = store.inventoryItems.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
        if (existing) return errorResponse('Item already exists');
        const price = Number(unitPrice || 0);
        if (price < 0) return errorResponse('Price cannot be negative');
        const openingStock = Number(initialStock || 0);
        if (openingStock < 0) return errorResponse('Opening stock cannot be negative');
        const item = {
          _id: createDevId('inventory'),
          name: name.trim(),
          unit: unit || 'pcs',
          unitPrice: price,
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
            enteredBy: userId,
            createdAt: now,
          } as DevInventoryTransaction);
        }
        return successResponse(item, 'Item added', 201);
      }

      if (action === 'log-sale' || action === 'add-restock') {
        const { itemId, quantity, amount, supplier, date, customerName, customerContact } = body;
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
          customerName: customerName || '',
          customerContact: customerContact || '',
          date: date ? new Date(date).toISOString() : now,
          enteredBy: userId,
          createdAt: now,
        } as DevInventoryTransaction;
        store.inventoryTransactions.unshift(txn);
        return successResponse({ item, transaction: { ...txn, itemId: item, enteredBy: devUserRef(userId) } }, action === 'log-sale' ? 'Sale logged' : 'Restock logged');
      }

      if (action === 'set-threshold') {
        const { itemId, threshold } = body;
        const item = store.inventoryItems.find((entry) => entry._id === itemId);
        if (!item) return errorResponse('Item not found', 404);
        item.lowStockThreshold = Number(threshold || 0);
        item.updatedAt = now;
        return successResponse(item, 'Threshold updated');
      }

      if (action === 'delete-item') {
        const { itemId } = body;
        if (!itemId) return errorResponse('Item ID required');
        const itemIndex = store.inventoryItems.findIndex((entry) => entry._id === itemId);
        if (itemIndex === -1) return errorResponse('Item not found', 404);
        store.inventoryItems[itemIndex].isActive = false;
        store.inventoryItems[itemIndex].updatedAt = now;
        return successResponse(null, 'Item deleted successfully');
      }

      return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('POST /api/inventory error:', error);
    return errorResponse('Failed to process', 500);
  }
}
