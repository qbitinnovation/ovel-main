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
  NOTIFICATIONS: 'notifications',
  REPORTS_ANALYTICS: 'reports_analytics',
  MALAYALAM_MOM: 'malayalam_mom',
  SAFETY_CHECKLIST: 'safety_checklist',
  AUDIT_LOG: 'audit_log',
  BOOKINGS: 'bookings',
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
    icon: '👥',
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
    icon: '💰',
    displayOrder: 2,
    availableActions: [
      'submit_daily_entry',
      'view_finance_history',
      'export_finance_report',
      'request_unlock',
    ],
  },
  {
    moduleKey: MODULE_KEYS.INVENTORY,
    moduleName: 'Inventory',
    description: 'Store and track turf items, equipment, and ground assets.',
    icon: '📦',
    displayOrder: 3,
    availableActions: [
      'add_turf_inventory_item',
      'update_turf_inventory_item',
      'view_turf_inventory',
      'export_turf_inventory_report',
    ],
  },
  {
    moduleKey: MODULE_KEYS.INVENTORY_SALES,
    moduleName: 'Sales',
    description: 'Product listing, sales entries with auto-decrement, and restocking.',
    icon: '📦',
    displayOrder: 4,
    availableActions: [
      'log_sale',
      'add_restock_entry',
      'view_inventory_levels',
      'set_low_stock_threshold',
      'export_inventory_report',
    ],
  },
  {
    moduleKey: MODULE_KEYS.MAINTENANCE_TASKS,
    moduleName: 'Maintenance & Tasks',
    description: 'Track physical maintenance issues from identification to resolution and closure.',
    icon: '🔧',
    displayOrder: 5,
    availableActions: [
      'create_task',
      'edit_task',
      'assign_task',
      'update_task_status',
      'close_task',
      'reopen_task',
      'delete_task',
      'view_all_tasks',
    ],
  },
  {
    moduleKey: MODULE_KEYS.DAILY_OPERATIONS,
    moduleName: 'Daily Operations & Staff Checklist',
    description: 'Daily verification of ground-level duties with live photo proof and supervisor approval.',
    icon: '✅',
    displayOrder: 6,
    availableActions: [
      'view_checklist',
      'submit_checklist_item',
      'resubmit_rejected_item',
      'approve_checklist_item',
      'reject_checklist_item',
    ],
  },
  {
    moduleKey: MODULE_KEYS.NOTIFICATIONS,
    moduleName: 'Notifications & Communication',
    description: 'Real-time alerts delivered to users when relevant events occur across the system.',
    icon: '🔔',
    displayOrder: 7,
    availableActions: [
      'configure_notification_rules',
      'manage_channels',
      'view_notification_log',
    ],
  },
  {
    moduleKey: MODULE_KEYS.REPORTS_ANALYTICS,
    moduleName: 'Reports & Analytics',
    description: 'Real-time dashboards and exportable reports across all operational modules.',
    icon: '📊',
    displayOrder: 8,
    availableActions: [
      'view_dashboards',
      'export_report',
      'schedule_report_delivery',
    ],
  },
  {
    moduleKey: MODULE_KEYS.MALAYALAM_MOM,
    moduleName: 'Malayalam Output & MOM',
    description: 'Minutes of Meeting documentation with English-to-Malayalam translation support.',
    icon: '📝',
    displayOrder: 9,
    availableActions: [
      'create_mom_entry',
      'convert_to_malayalam',
      'edit_translation',
      'save_mom_record',
      'attach_malayalam_instruction',
      'view_mom_history',
    ],
  },
  {
    moduleKey: MODULE_KEYS.SAFETY_CHECKLIST,
    moduleName: 'Smart Attendance & Safety Checklist',
    description: 'End-of-day safety verification before Turf Manager logout with permanent records.',
    icon: '🛡️',
    displayOrder: 10,
    availableActions: [
      'complete_safety_checklist',
      'confirm_logout',
    ],
  },
  {
    moduleKey: MODULE_KEYS.AUDIT_LOG,
    moduleName: 'Audit & Activity Log',
    description: 'Permanent, tamper-proof record of every action taken by every user across the system.',
    icon: '📋',
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
    icon: '📅',
    displayOrder: 12,
    availableActions: [
      'create_booking',
      'edit_booking',
      'cancel_booking',
      'add_payment_entry',
      'edit_payment_entry',
      'export_payment_report',
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
  submit_daily_entry: 'Submit Daily Entry',
  view_finance_history: 'View Finance History',
  export_finance_report: 'Export Finance Report',
  request_unlock: 'Request Unlock',
  // Inventory
  add_turf_inventory_item: 'Add Turf Inventory Item',
  update_turf_inventory_item: 'Update Turf Inventory Item',
  view_turf_inventory: 'View Turf Inventory',
  export_turf_inventory_report: 'Export Turf Inventory Report',
  // Sales
  log_sale: 'Log Sale',
  add_restock_entry: 'Add Restock Entry',
  view_inventory_levels: 'View Inventory Levels',
  set_low_stock_threshold: 'Set Low Stock Threshold',
  export_inventory_report: 'Export Inventory Report',
  // Maintenance & Tasks
  create_task: 'Create Task',
  edit_task: 'Edit Task',
  assign_task: 'Assign Task',
  update_task_status: 'Update Task Status',
  close_task: 'Close Task',
  reopen_task: 'Reopen Task',
  delete_task: 'Delete Task',
  view_all_tasks: 'View All Tasks',
  // Daily Operations
  view_checklist: 'View Checklist',
  submit_checklist_item: 'Submit Checklist Item',
  resubmit_rejected_item: 'Resubmit Rejected Item',
  approve_checklist_item: 'Approve Checklist Item',
  reject_checklist_item: 'Reject Checklist Item',
  // Notifications
  configure_notification_rules: 'Configure Notification Rules',
  manage_channels: 'Manage Channels',
  view_notification_log: 'View Notification Log',
  // Reports
  view_dashboards: 'View Dashboards',
  export_report: 'Export Report',
  schedule_report_delivery: 'Schedule Report Delivery',
  // Malayalam & MOM
  create_mom_entry: 'Create MOM Entry',
  convert_to_malayalam: 'Convert to Malayalam',
  edit_translation: 'Edit Translation',
  save_mom_record: 'Save MOM Record',
  attach_malayalam_instruction: 'Attach Malayalam Instruction',
  view_mom_history: 'View MOM History',
  // Safety Checklist
  complete_safety_checklist: 'Complete Safety Checklist',
  confirm_logout: 'Confirm Logout',
  // Audit
  view_audit_logs: 'View Audit Logs',
  search_filter_logs: 'Search & Filter Logs',
  export_audit_report: 'Export Audit Report',
  // Bookings & Payments
  create_booking: 'Create Booking',
  edit_booking: 'Edit Booking',
  cancel_booking: 'Cancel Booking',
  add_payment_entry: 'Add Payment Entry',
  edit_payment_entry: 'Edit Payment Entry',
  export_payment_report: 'Export Payment Report',
  view_payment_dashboard: 'View Payment Dashboard',
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
