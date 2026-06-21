type PortalType = 'superadmin' | 'committee' | 'turf' | 'shareholder';
type UserType = 'superadmin' | 'management' | 'staff';

export interface DevPosition {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash?: string;
  userType: UserType;
  portalType: PortalType;
  positionId: string | null;
  isActive: boolean;
  isArchived: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DevStore {
  users: DevUser[];
  positions: DevPosition[];
  settings: DevSetting[];
  inventoryItems: DevInventoryItem[];
  inventoryTransactions: DevInventoryTransaction[];
  turfInventoryItems: DevTurfInventoryItem[];
  maintenanceTasks: DevMaintenanceTask[];
  moduleMappings: DevModuleMapping[];
  portalMappings: DevPortalMapping[];
  checklists: DevChecklist[];
  momRecords: DevMomRecord[];
  bookings: DevBooking[];
  payments: DevPayment[];
  accountTransactions: DevAccountTransaction[];
}

export interface DevAccountTransaction {
  _id: string;
  type: 'income' | 'expense';
  source: string;
  amount: number;
  paymentMode: string;
  customerName: string;
  customerContact: string;
  summary: string;
  referenceNumber: string;
  date: string;
  createdBy: string;
  bookingId?: string;
  inventoryTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevSetting {
  _id: string;
  key: string;
  value: unknown;
  label: string;
  category: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevInventoryItem {
  _id: string;
  name: string;
  unit: string;
  unitPrice: number;
  currentStock: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevInventoryTransaction {
  _id: string;
  itemId: string;
  type: 'sale' | 'restock';
  quantity: number;
  amount: number;
  supplier: string;
  date: string;
  enteredBy: string;
  createdAt: string;
}

export interface DevTurfInventoryItem {
  _id: string;
  name: string;
  category: string;
  quantity: number;
  location: string;
  condition: 'good' | 'needs_repair' | 'damaged' | 'missing';
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevMaintenanceTask {
  _id: string;
  title: string;
  description: string;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
  assigneeId: string;
  creatorId: string;
  status: 'open' | 'in_progress' | 'completed' | 'closed' | 'overdue';
  resolutionNote: string;
  statusHistory: { status: string; changedBy: string; changedAt: string; note: string }[];
  closedAt: string | null;
  closedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevModuleMapping {
  _id: string;
  positionId: string;
  moduleKey: string;
  accessLevel: 'view' | 'edit' | 'full_control';
  enabledActions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevPortalMapping {
  _id: string;
  portalType: 'turf' | 'shareholder';
  moduleKey: string;
  accessLevel: 'view' | 'edit' | 'full_control';
  enabledActions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevChecklistItem {
  key: string;
  label: string;
  labelMl: string;
  photoUrl: string;
  gpsLat: number | null;
  gpsLng: number | null;
  capturedAt: string | null;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'unverified';
  supervisorNote: string;
  rejectedAt: string | null;
  approvedAt: string | null;
}

export interface DevChecklist {
  _id: string;
  staffId: string;
  date: string;
  items: DevChecklistItem[];
  overallStatus: 'pending' | 'submitted' | 'verified' | 'partially_verified' | 'unverified';
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  uploadDeadline: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevMomRecord {
  _id: string;
  date: string;
  attendees: string[];
  pointsEnglish: string;
  pointsMalayalam: string;
  decisions: string[];
  linkedTaskIds: string[];
  pendingTasksSummary: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevBooking {
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  contactNumber: string;
  expectedAmount: number;
  priceType?: 'normal' | 'regular';
  pricingSnapshot?: unknown;
  notes: string;
  bookingStatus: 'confirmed' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid';
  totalPaid: number;
  discountAmount?: number;
  discountPercentage?: number;
  cancelReason: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  bulkId?: string | null;
}

export interface DevPayment {
  _id: string;
  bookingId: string;
  amountPaid: number;
  paymentMode: 'bank_transfer' | 'upi' | 'card' | 'cash' | 'split';
  paymentDate: string;
  referenceNumber: string;
  cashReceivedBy: 'turf_staff' | 'turf_owner' | 'arjo' | '';
  referenceNote: string;
  discountAmount?: number;
  discountPercentage?: number;
  splits?: {
    amount: number;
    paymentMode: 'bank_transfer' | 'upi' | 'card' | 'cash';
    referenceNumber: string;
    cashReceivedBy: 'turf_staff' | 'turf_owner' | 'arjo' | '';
    referenceNote: string;
  }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var omsDevStore: DevStore | undefined;
}

export function isDevFallbackEnabled() {
  return process.env.NODE_ENV === 'development';
}

export function getDevStore() {
  const demoUsers: DevUser[] = [
    {
      _id: '000000000000000000000001',
      name: 'Super Admin (Demo)',
      email: 'admin@ovalturf.com',
      phone: '+910000000001',
      userType: 'superadmin',
      portalType: 'superadmin',
      positionId: null,
      isActive: true,
      isArchived: false,
      mustChangePassword: false,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: '000000000000000000000002',
      name: 'Committee Member (Demo)',
      email: 'committee@ovalturf.com',
      phone: '+910000000002',
      userType: 'management',
      portalType: 'committee',
      positionId: 'demo-position',
      isActive: true,
      isArchived: false,
      mustChangePassword: false,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: '000000000000000000000004',
      name: 'Shareholder (Demo)',
      email: 'shareholder@ovalturf.com',
      phone: '+910000000004',
      userType: 'management',
      portalType: 'shareholder',
      positionId: null,
      isActive: true,
      isArchived: false,
      mustChangePassword: false,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  if (!global.omsDevStore) {
    global.omsDevStore = {
      users: demoUsers,
      positions: [
        {
          _id: 'demo-position',
          name: 'Committee Member',
          description: 'Demo Committee Position',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ],
      settings: [],
      inventoryItems: [],
      inventoryTransactions: [],
      turfInventoryItems: [],
      maintenanceTasks: [],
      moduleMappings: [
        {
          _id: 'dev-module-map-committee-ops',
          positionId: 'demo-position',
          moduleKey: 'daily_operations',
          accessLevel: 'full_control',
          enabledActions: ['view_checklist', 'upload_checklist', 'verify_checklist', 'approve_checklist', 'reject_checklist', 'edit_checklist'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          _id: 'dev-module-map-committee-users',
          positionId: 'demo-position',
          moduleKey: 'user_permission',
          accessLevel: 'full_control',
          enabledActions: [
            'create_user', 'archive_user', 'edit_user', 'create_position', 'edit_position',
            'deactivate_position', 'map_module_to_position', 'remove_module_from_position',
            'assign_position_to_user', 'remove_position_from_user', 'add_individual_override', 'remove_override',
          ],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ],
      portalMappings: [
        {
          _id: 'dev-portal-map-turf-ops',
          portalType: 'turf',
          moduleKey: 'daily_operations',
          accessLevel: 'edit',
          enabledActions: ['view_checklist', 'upload_checklist'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          _id: 'dev-portal-map-shareholder-ops',
          portalType: 'shareholder',
          moduleKey: 'daily_operations',
          accessLevel: 'view',
          enabledActions: ['view_checklist'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ],
      checklists: [],
      momRecords: [],
      bookings: [],
      payments: [],
      accountTransactions: [],
    };
  }

  global.omsDevStore.inventoryItems ||= [];
  global.omsDevStore.settings ||= [];
  global.omsDevStore.inventoryTransactions ||= [];
  global.omsDevStore.turfInventoryItems ||= [];
  global.omsDevStore.maintenanceTasks ||= [];
  global.omsDevStore.moduleMappings ||= [];
  global.omsDevStore.portalMappings ||= [];
  global.omsDevStore.checklists ||= [];
  global.omsDevStore.momRecords ||= [];
  global.omsDevStore.bookings ||= [];
  global.omsDevStore.payments ||= [];
  global.omsDevStore.accountTransactions ||= [];

  if (global.omsDevStore.users) {
    global.omsDevStore.users = global.omsDevStore.users.filter(
      (user) => user._id !== '000000000000000000000003'
    );
  }
  if (global.omsDevStore.checklists) {
    global.omsDevStore.checklists = global.omsDevStore.checklists.filter(
      (checklist) => checklist.staffId !== '000000000000000000000003'
    );
  }

  for (const demoUser of demoUsers) {
    if (!global.omsDevStore.users.some((user) => user._id === demoUser._id)) {
      global.omsDevStore.users.unshift(demoUser);
    }
  }

  return global.omsDevStore;
}

export function populateDevUserPosition(user: DevUser) {
  const store = getDevStore();
  const position = user.positionId
    ? store.positions.find((item) => item._id === user.positionId) || null
    : null;
  const { passwordHash, ...safeUser } = user;
  void passwordHash;

  return {
    ...safeUser,
    positionId: position ? { _id: position._id, name: position.name, isActive: position.isActive } : null,
  };
}

export function createDevId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function devUserRef(id: string | null) {
  if (!id) return null;
  const user = getDevStore().users.find((item) => item._id === id);
  if (user) return { _id: user._id, name: user.name, email: user.email };

  // Static demo user fallbacks
  if (id === '000000000000000000000001') {
    return { _id: id, name: 'Super Admin (Demo)', email: 'admin@ovalturf.com' };
  } else if (id === '000000000000000000000002') {
    return { _id: id, name: 'Committee Member (Demo)', email: 'committee@ovalturf.com' };
  } else if (id === '000000000000000000000003') {
    return { _id: id, name: 'Turf Staff (Demo)', email: 'staff@ovalturf.com' };
  } else if (id === '000000000000000000000004') {
    return { _id: id, name: 'Shareholder (Demo)', email: 'shareholder@ovalturf.com' };
  }

  return { _id: id, name: 'User', email: '' };
}

export function devPositionRef(id: string) {
  const position = getDevStore().positions.find((item) => item._id === id);
  return position ? { _id: position._id, name: position.name, isActive: position.isActive } : { _id: id, name: 'Unknown Position', isActive: true };
}
