import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import TurfInventoryItem from '@/models/TurfInventoryItem';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta, sanitizeInput } from '@/lib/utils';
import { createDevId, getDevStore, isDevFallbackEnabled, type DevTurfInventoryItem } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

const VALID_CONDITIONS = ['good', 'needs_repair', 'damaged', 'missing'] as const;
type Condition = (typeof VALID_CONDITIONS)[number];

function parseCondition(value: unknown): Condition {
  return VALID_CONDITIONS.includes(value as Condition) ? (value as Condition) : 'good';
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      return successResponse({
        items: store.turfInventoryItems.filter((item) => item.isActive).sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    const items = await TurfInventoryItem.find({ isActive: true }).sort({ name: 1 });
    return successResponse({ items });
  } catch (error) {
    console.error('GET /api/turf-inventory error:', error);
    return errorResponse('Failed to fetch turf inventory', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { action } = body;
    const meta = getRequestMeta(request.headers);

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (action === 'add-item') {
      const name = sanitizeInput(body.name || '');
      if (!name) return errorResponse('Item name is required');

      const itemData = {
        name,
        category: sanitizeInput(body.category || 'General') || 'General',
        quantity: Math.max(0, Number(body.quantity || 0)),
        location: sanitizeInput(body.location || 'Turf') || 'Turf',
        condition: parseCondition(body.condition),
        notes: sanitizeInput(body.notes || ''),
      };

      if (useDevStore) {
        const now = new Date().toISOString();
        const item: DevTurfInventoryItem = {
          _id: createDevId('turf-inventory'),
          ...itemData,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        getDevStore().turfInventoryItems.unshift(item);
        return successResponse(item, 'Inventory item added', 201);
      }

      const item = await TurfInventoryItem.create(itemData);
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'add_turf_inventory_item', module: 'inventory', recordId: item._id, description: `Added turf inventory item "${item.name}"`, ...meta }, request.headers);
      return successResponse(item, 'Inventory item added', 201);
    }

    if (action === 'update-item') {
      const { itemId } = body;
      if (!itemId) return errorResponse('Item ID required');

      if (useDevStore) {
        const store = getDevStore();
        const item = store.turfInventoryItems.find((entry) => entry._id === itemId);
        if (!item) return errorResponse('Item not found', 404);
        if (body.name !== undefined) item.name = sanitizeInput(body.name);
        if (body.category !== undefined) item.category = sanitizeInput(body.category) || 'General';
        if (body.quantity !== undefined) item.quantity = Math.max(0, Number(body.quantity || 0));
        if (body.location !== undefined) item.location = sanitizeInput(body.location) || 'Turf';
        if (body.condition !== undefined) item.condition = parseCondition(body.condition);
        if (body.notes !== undefined) item.notes = sanitizeInput(body.notes);
        item.updatedAt = new Date().toISOString();
        return successResponse(item, 'Inventory item updated');
      }

      const item = await TurfInventoryItem.findById(itemId);
      if (!item) return errorResponse('Item not found', 404);
      if (body.name !== undefined) item.name = sanitizeInput(body.name);
      if (body.category !== undefined) item.category = sanitizeInput(body.category) || 'General';
      if (body.quantity !== undefined) item.quantity = Math.max(0, Number(body.quantity || 0));
      if (body.location !== undefined) item.location = sanitizeInput(body.location) || 'Turf';
      if (body.condition !== undefined) item.condition = parseCondition(body.condition);
      if (body.notes !== undefined) item.notes = sanitizeInput(body.notes);
      await item.save();
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'update_turf_inventory_item', module: 'inventory', recordId: item._id, description: `Updated turf inventory item "${item.name}"`, ...meta }, request.headers);
      return successResponse(item, 'Inventory item updated');
    }

    return errorResponse('Invalid action');
  } catch (error) {
    console.error('POST /api/turf-inventory error:', error);
    return errorResponse('Failed to process turf inventory', 500);
  }
}
