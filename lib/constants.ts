/**
 * OMS System Constants
 * Central registry of all module keys, actions, user types, and enums
 */

// ---- User Types ----
export const USER_TYPES = {
  SUPERADMIN: 'superadmin',
  MANAGEMENT: 'management',
  STAFF: 'staff',
} as const;

export type UserType = (typeof USER_TYPES)[keyof typeof USER_TYPES];

// ---- Portal Types ----
export const PORTAL_TYPES = {
  SUPERADMIN: 'superadmin',
  COMMITTEE: 'committee',
  TURF: 'turf',
  SHAREHOLDER: 'shareholder',
} as const;

export type PortalType = (typeof PORTAL_TYPES)[keyof typeof PORTAL_TYPES];

// ---- Access Levels ----
export const ACCESS_LEVELS = {
  VIEW: 'view',
  EDIT: 'edit',
  FULL_CONTROL: 'full_control',
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

// ---- Module Keys ----
export const MODULE_KEYS = {
  USER_PERMISSION: 'user_permission',
  ACCOUNTS_FINANCE: 'accounts_finance',
  INVENTORY: 'inventory',
  INVENTORY_SALES: 'inventory_sales',
  MAINTENANCE_TASKS: 'maintenance_tasks',
  DAILY_OPERATIONS: 'daily_operations',
  MALAYALAM_MOM: 'malayalam_mom',
  SAFETY_CHECKLIST: 'safety_checklist',
  AUDIT_LOG: 'audit_log',
  BOOKINGS: 'bookings',
  SMART_ATTENDANCE: 'smart_attendance',
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

// ---- Module Definition Type ----
export interface ModuleDefinition {
  moduleKey: ModuleKey;
  moduleName: string;
  description: string;
  icon: string;
  displayOrder: number;
  availableActions: string[];
}

// ---- Module Definitions with Actions ----
export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    moduleKey: MODULE_KEYS.USER_PERMISSION,
    moduleName: 'User & Permission Management',
    description: 'Manage all users, module mappings, and system-wide access control.',
    icon: 'Users',
    displayOrder: 1,
    availableActions: [
      'create_user',
      'archive_user',
      'edit_user',
      'map_module_to_position',
      'remove_module_from_position',
      'add_individual_override',
      'remove_override',
    ],
  },
  {
    moduleKey: MODULE_KEYS.ACCOUNTS_FINANCE,
    moduleName: 'Accounts & Finance',
    description: 'Daily financial recording — income, expenses, electricity charges, and other payments.',
    icon: 'Wallet',
    displayOrder: 2,
    availableActions: [
      'view_transactions',
      'add_transaction',
      'export_reports',
    ],
  },
  {
    moduleKey: MODULE_KEYS.INVENTORY,
    moduleName: 'Inventory',
    description: 'Store and track turf items, equipment, and ground assets.',
    icon: 'Package',
    displayOrder: 3,
    availableActions: [
      'view_items',
      'add_item',
      'edit_item',
      'delete_item',
      'export_turf_inventory_report',
    ],
  },
  {
    moduleKey: MODULE_KEYS.INVENTORY_SALES,
    moduleName: 'Sales',
    description: 'Product listing, sales entries with auto-decrement, and restocking.',
    icon: 'ShoppingCart',
    displayOrder: 4,
    availableActions: [
      'view_sales',
      'add_item',
      'create_sale',
      'add_restock',
      'delete_item',
      'export_sales_report',
      'view_sales_history',
    ],
  },
  {
    moduleKey: MODULE_KEYS.MAINTENANCE_TASKS,
    moduleName: 'Maintenance & Tasks',
    description: 'Track physical maintenance issues from identification to resolution and closure.',
    icon: 'Wrench',
    displayOrder: 5,
    availableActions: [
      'view_all_tasks',
      'create_task',
      'edit_task',
      'complete_task',
      'assign_task',
      'reopen_task',
      'delete_task',
    ],
  },
  {
    moduleKey: MODULE_KEYS.DAILY_OPERATIONS,
    moduleName: 'Daily Operations & Staff Checklist',
    description: 'Daily verification of ground-level duties with live photo proof and supervisor approval.',
    icon: 'CheckSquare',
    displayOrder: 6,
    availableActions: [
      'view_checklist',
      'upload_checklist',
      'verify_checklist',
      'approve_checklist',
      'reject_checklist',
    ],
  },

  {
    moduleKey: MODULE_KEYS.MALAYALAM_MOM,
    moduleName: 'Malayalam Output & MOM',
    description: 'Minutes of Meeting documentation with English-to-Malayalam translation support.',
    icon: 'FileText',
    displayOrder: 9,
    availableActions: [
      'create_mom_entry',
      'convert_to_malayalam',
      'edit_mom',
      'view_mom_history',
      'export_mom_history',
    ],
  },
  {
    moduleKey: MODULE_KEYS.SAFETY_CHECKLIST,
    moduleName: 'Smart Attendance & Safety Checklist',
    description: 'End-of-day safety verification before Turf Manager logout with permanent records.',
    icon: 'ShieldCheck',
    displayOrder: 10,
    availableActions: [
      'complete_safety_checklist',
      'confirm_logout',
    ],
  },
  {
    moduleKey: MODULE_KEYS.SMART_ATTENDANCE,
    moduleName: 'Smart Attendance',
    description: 'Geofenced attendance submission and verification system.',
    icon: 'MapPin',
    displayOrder: 11,
    availableActions: [
      'submit_attendance',
      'verify_attendance',
      'view_attendance_reports',
    ],
  },
  {
    moduleKey: MODULE_KEYS.AUDIT_LOG,
    moduleName: 'Audit & Activity Log',
    description: 'Permanent, tamper-proof record of every action taken by every user across the system.',
    icon: 'ClipboardList',
    displayOrder: 11,
    availableActions: [
      'view_audit_logs',
      'search_filter_logs',
      'export_audit_report',
    ],
  },
  {
    moduleKey: MODULE_KEYS.BOOKINGS,
    moduleName: 'Bookings & Payments',
    description: 'Turf booking reservations and payment tracking with cash holder visibility.',
    icon: 'Calendar',
    displayOrder: 12,
    availableActions: [
      'view_booking',
      'create_booking',
      'edit_booking',
      'cancel_booking',
      'add_payment',
      'export_payment',
      'export_bill',
      'view_payment_dashboard',
    ],
  },
];

// ---- Action Labels (human-readable) ----
export const ACTION_LABELS: Record<string, string> = {
  // User & Permission
  create_user: 'Create User',
  archive_user: 'Archive User',
  edit_user: 'Edit User',
  map_module_to_position: 'Map Module to Position',
  remove_module_from_position: 'Remove Module from Position',
  add_individual_override: 'Add Individual Override',
  remove_override: 'Remove Override',
  // Accounts & Finance
  view_transactions: 'View Transactions',
  add_transaction: 'Add Transaction',
  edit_transaction: 'Edit Transaction',
  delete_transaction: 'Delete Transaction',
  export_reports: 'Export Reports',
  request_unlock: 'Request Unlock',
  // Inventory
  view_items: 'View Items',
  add_item: 'Add Item',
  edit_item: 'Edit Item',
  delete_item: 'Delete Item',
  stock_update: 'Stock Update',
  export_turf_inventory_report: 'Export Turf Inventory Report',
  view_sales: 'View Sales',
  create_sale: 'Log Sale',
  add_restock: 'Add Restock',
  export_sales_report: 'Export Sales Report',
  view_sales_history: 'View Sales History',
  // Maintenance & Tasks
  view_all_tasks: 'View All Tasks',
  create_task: 'Create Task',
  edit_task: 'Edit Task',
  complete_task: 'Complete Task',
  assign_task: 'Assign Task',
  reopen_task: 'Reopen Task',
  delete_task: 'Delete Task',
  // Daily Operations
  view_checklist: 'View Checklist',
  upload_checklist: 'Upload Checklist',
  verify_checklist: 'Verify Checklist',
  approve_checklist: 'Approve Checklist',
  reject_checklist: 'Reject Checklist',
  edit_checklist: 'Edit Checklist',
  // Reports
  view_reports: 'View Reports',
  schedule_report_delivery: 'Schedule Report Delivery',
  // Malayalam & MOM
  create_mom_entry: 'Create MOM Entry',
  convert_to_malayalam: 'Convert to Malayalam',
  edit_mom: 'Edit MOM',
  view_mom_history: 'View MOM History',
  export_mom_history: 'Export MOM History',
  // Safety Checklist
  complete_safety_checklist: 'Complete Safety Checklist',
  confirm_logout: 'Confirm Logout',
  // Smart Attendance
  submit_attendance: 'Submit Attendance',
  verify_attendance: 'Verify Attendance',
  view_attendance_reports: 'View Attendance Reports',
  // Audit
  view_audit_logs: 'View Audit Logs',
  search_filter_logs: 'Search & Filter Logs',
  export_audit_report: 'Export Audit Report',
  // Bookings & Payments
  view_booking: 'View Booking',
  create_booking: 'Create Booking',
  edit_booking: 'Edit Booking',
  cancel_booking: 'Cancel Booking',
  add_payment: 'Add Payment',
  export_payment: 'Export Payment',
  export_bill: 'Export Bill',
  view_payment_dashboard: 'View Payment Dashboard',
  // Complaints
  submit_complaint: 'Submit Complaint',
  view_complaints: 'View Complaints',
  resolve_complaint: 'Resolve Complaint',
  view_feedback_analytics: 'View Feedback Analytics',
};

// ---- Portal Routes ----
export const PORTAL_ROUTES: Record<PortalType, string> = {
  [PORTAL_TYPES.SUPERADMIN]: '/superadmin',
  [PORTAL_TYPES.COMMITTEE]: '/committee',
  [PORTAL_TYPES.TURF]: '/turf-manager',
  [PORTAL_TYPES.SHAREHOLDER]: '/shareholder',
};

// ---- Safety Checklist Items ----
export interface SafetyChecklistItem {
  key: string;
  label: string;
  labelMl: string;
}

export const SAFETY_CHECKLIST_ITEMS: SafetyChecklistItem[] = [
  { key: 'lights_off', label: 'Lights switched off', labelMl: 'ലൈറ്റുകൾ ഓഫ് ചെയ്തു' },
  { key: 'staff_tasks_verified', label: 'Staff tasks verified', labelMl: 'സ്റ്റാഫ് ടാസ്കുകൾ പരിശോധിച്ചു' },
  { key: 'gates_locked', label: 'Main gates locked', labelMl: 'പ്രധാന ഗേറ്റുകൾ പൂട്ടി' },
  { key: 'cash_handover', label: 'Daily cash handover confirmed', labelMl: 'ദൈനംദിന ക്യാഷ് കൈമാറ്റം സ്ഥിരീകരിച്ചു' },
];

// ---- Finance Entry Categories ----
export const FINANCE_CATEGORIES: Record<string, string[]> = {
  income: ['Turf Booking', 'Membership Fee', 'Event Revenue', 'Sponsorship', 'Other Income'],
  expenses: ['Maintenance', 'Equipment', 'Salaries', 'Utilities', 'Supplies', 'Other Expense'],
  electricity: ['Monthly Bill', 'Generator Fuel', 'Solar Maintenance'],
  other_payments: ['Insurance', 'License Fee', 'Government Tax', 'Vendor Payment', 'Other Payment'],
};

// ---- Task Priority Levels ----
export const TASK_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[keyof typeof TASK_PRIORITIES];

export const TASK_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  OVERDUE: 'overdue',
} as const;

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];

// Trigger Next.js Rebuild
