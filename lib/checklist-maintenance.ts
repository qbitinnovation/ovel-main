import { Types } from 'mongoose';
import Checklist from '@/models/Checklist';
import User from '@/models/User';
import { createDevId, getDevStore, isDevFallbackEnabled, type DevChecklist } from '@/lib/dev-store';
import { SUPERVISOR_CHECKLIST_ITEMS } from '@/lib/supervisor-checklist';

export const CHECKLIST_HISTORY_LIMIT = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var omsChecklistMaintenanceScheduler:
    | {
        timeout: ReturnType<typeof setTimeout> | null;
        interval: ReturnType<typeof setInterval> | null;
      }
    | undefined;
}

export function startOfChecklistDay(date: Date | string = new Date()) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function getChecklistDayRange(date: Date | string = new Date()) {
  const start = startOfChecklistDay(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function isSameChecklistDay(left: Date | string, right: Date | string) {
  return startOfChecklistDay(left).getTime() === startOfChecklistDay(right).getTime();
}

export async function runChecklistMaintenance(options: { staffId?: string | null; today?: Date } = {}) {
  const staffIds = await getChecklistStaffIds(options.staffId);

  for (const staffId of staffIds) {
    await ensureDailyChecklistForStaff(staffId, options.today);
    await pruneChecklistHistoryForStaff(staffId);
  }
}

export function runDevChecklistMaintenance(options: { staffId?: string | null; today?: Date } = {}) {
  const staffIds = getDevChecklistStaffIds(options.staffId);

  for (const staffId of staffIds) {
    ensureDevDailyChecklistForStaff(staffId, options.today);
    pruneDevChecklistHistoryForStaff(staffId);
  }
}

export function startChecklistMaintenanceScheduler() {
  if (global.omsChecklistMaintenanceScheduler) return;

  global.omsChecklistMaintenanceScheduler = { timeout: null, interval: null };

  const run = async () => {
    try {
      const { default: dbConnect } = await import('@/lib/db');
      await dbConnect();
      await runChecklistMaintenance();
    } catch (error) {
      if (isDevFallbackEnabled()) {
        runDevChecklistMaintenance();
        return;
      }
      console.error('Daily checklist maintenance failed:', error);
    }
  };

  const now = new Date();
  const nextRun = startOfChecklistDay(now);
  nextRun.setDate(nextRun.getDate() + 1);
  nextRun.setMinutes(1, 0, 0);
  const delay = Math.max(1000, nextRun.getTime() - now.getTime());

  void run();
  global.omsChecklistMaintenanceScheduler.timeout = setTimeout(() => {
    void run();
    global.omsChecklistMaintenanceScheduler!.interval = setInterval(() => {
      void run();
    }, ONE_DAY_MS);
  }, delay);
}

export async function ensureDailyChecklistForStaff(staffId: string, today: Date = new Date()) {
  const { start, end } = getChecklistDayRange(today);
  const existing = await Checklist.findOne({
    staffId,
    date: { $gte: start, $lt: end },
  });

  if (existing) return existing;

  return Checklist.create({
    staffId,
    date: start,
    items: SUPERVISOR_CHECKLIST_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      labelMl: item.labelMl || '',
      status: 'pending',
    })),
    overallStatus: 'pending',
    uploadDeadline: end,
  });
}

export async function pruneChecklistHistoryForStaff(staffId: string) {
  const staleChecklists = await Checklist.find({ staffId })
    .sort({ date: -1, createdAt: -1 })
    .skip(CHECKLIST_HISTORY_LIMIT)
    .select('_id date')
    .lean();

  for (const checklist of staleChecklists.reverse()) {
    await Checklist.deleteOne({ _id: checklist._id });
  }
}

export function ensureDevDailyChecklistForStaff(staffId: string, today: Date = new Date()) {
  const store = getDevStore();
  const actualStaffId = getDevChecklistStaffId(staffId);
  const { start, end } = getChecklistDayRange(today);
  const existing = store.checklists.find(
    (checklist) => checklist.staffId === actualStaffId && isSameChecklistDay(checklist.date, start)
  );

  if (existing) return existing;

  const now = new Date().toISOString();
  const checklist: DevChecklist = {
    _id: createDevId('checklist'),
    staffId: actualStaffId,
    date: start.toISOString(),
    items: SUPERVISOR_CHECKLIST_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      labelMl: item.labelMl || '',
      photoUrl: '',
      gpsLat: null,
      gpsLng: null,
      capturedAt: null,
      status: 'pending',
      supervisorNote: '',
      rejectedAt: null,
      approvedAt: null,
    })),
    overallStatus: 'pending',
    submittedAt: null,
    verifiedAt: null,
    verifiedBy: null,
    uploadDeadline: end.toISOString(),
    createdAt: now,
    updatedAt: now,
  };

  store.checklists.unshift(checklist);
  return checklist;
}

export function pruneDevChecklistHistoryForStaff(staffId: string) {
  const store = getDevStore();
  const actualStaffId = getDevChecklistStaffId(staffId);
  const staffChecklists = store.checklists
    .filter((checklist) => checklist.staffId === actualStaffId)
    .sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  const staleIds = staffChecklists.slice(CHECKLIST_HISTORY_LIMIT).reverse().map((checklist) => checklist._id);

  for (const staleId of staleIds) {
    const index = store.checklists.findIndex((checklist) => checklist._id === staleId);
    if (index >= 0) store.checklists.splice(index, 1);
  }
}

async function getChecklistStaffIds(staffId?: string | null) {
  if (staffId) {
    return Types.ObjectId.isValid(staffId) ? [staffId] : [];
  }

  const staffUsers = await User.find({
    userType: 'staff',
    portalType: 'turf',
    isActive: true,
    isArchived: false,
  }).select('_id');

  return staffUsers.map((user) => user._id.toString());
}

function getDevChecklistStaffIds(staffId?: string | null) {
  if (staffId) return [getDevChecklistStaffId(staffId)];

  return getDevStore().users
    .filter((user) => user.userType === 'staff' && user.portalType === 'turf' && user.isActive && !user.isArchived)
    .map((user) => user._id);
}

function getDevChecklistStaffId(staffId: string) {
  return staffId === 'demo-superadmin' ? 'demo-turf' : staffId;
}
