/**
 * OMS Database Seed Script
 *
 * Seeds the SuperAdmin user and all module configurations.
 * Safe to run multiple times — uses upsert operations.
 *
 * Usage: node --experimental-modules scripts/seed.mjs
 * Or via: npx tsx scripts/seed.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env.local');
  process.exit(1);
}

// ---- Schemas (inline to avoid import issues with Next.js models) ----

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  userType: { type: String, required: true, enum: ['superadmin', 'management', 'staff'] },
  portalType: { type: String, required: true, enum: ['superadmin', 'committee', 'turf', 'shareholder'] },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', default: null },
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  mustChangePassword: { type: Boolean, default: false },
  lastLogin: { type: Date, default: null },
}, { timestamps: true });

const ModuleConfigSchema = new mongoose.Schema({
  moduleKey: { type: String, required: true, unique: true },
  moduleName: { type: String, required: true },
  description: { type: String, default: '' },
  availableActions: [{ type: String }],
  icon: { type: String, default: '📦' },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
}, { timestamps: true });

// ---- Module Definitions ----
const MODULE_DEFINITIONS = [
  {
    moduleKey: 'user_permission',
    moduleName: 'User & Permission Management',
    description: 'Manage all users, positions, module mappings, and system-wide access control.',
    icon: '👥',
    displayOrder: 1,
    availableActions: [
      'create_user', 'archive_user', 'edit_user', 'create_position', 'edit_position',
      'deactivate_position', 'map_module_to_position', 'remove_module_from_position',
      'assign_position_to_user', 'remove_position_from_user', 'add_individual_override', 'remove_override',
    ],
  },
  {
    moduleKey: 'accounts_finance',
    moduleName: 'Accounts & Finance',
    description: 'Daily financial recording — income, expenses, electricity charges, and other payments.',
    icon: '💰',
    displayOrder: 2,
    availableActions: ['submit_daily_entry', 'view_finance_history', 'export_finance_report', 'request_unlock'],
  },
  {
    moduleKey: 'inventory_sales',
    moduleName: 'Inventory & Sales',
    description: 'Real-time tracking of consumables, sales entries with auto-decrement, and stock alerts.',
    icon: '📦',
    displayOrder: 3,
    availableActions: ['log_sale', 'add_restock_entry', 'view_inventory_levels', 'set_low_stock_threshold', 'export_inventory_report'],
  },
  {
    moduleKey: 'maintenance_tasks',
    moduleName: 'Maintenance & Tasks',
    description: 'Track physical maintenance issues from identification to resolution and closure.',
    icon: '🔧',
    displayOrder: 4,
    availableActions: ['create_task', 'edit_task', 'assign_task', 'update_task_status', 'close_task', 'reopen_task', 'delete_task', 'view_all_tasks'],
  },
  {
    moduleKey: 'daily_operations',
    moduleName: 'Daily Operations & Staff Checklist',
    description: 'Daily verification of ground-level duties with live photo proof and supervisor approval.',
    icon: '✅',
    displayOrder: 5,
    availableActions: ['view_checklist', 'submit_checklist_item', 'resubmit_rejected_item', 'approve_checklist_item', 'reject_checklist_item'],
  },
  {
    moduleKey: 'notifications',
    moduleName: 'Notifications & Communication',
    description: 'Real-time alerts delivered to users when relevant events occur across the system.',
    icon: '🔔',
    displayOrder: 6,
    availableActions: ['configure_notification_rules', 'manage_channels', 'view_notification_log'],
  },
  {
    moduleKey: 'reports_analytics',
    moduleName: 'Reports & Analytics',
    description: 'Real-time dashboards and exportable reports across all operational modules.',
    icon: '📊',
    displayOrder: 7,
    availableActions: ['view_dashboards', 'export_report', 'schedule_report_delivery'],
  },
  {
    moduleKey: 'malayalam_mom',
    moduleName: 'Malayalam Output & MOM',
    description: 'Minutes of Meeting documentation with English-to-Malayalam translation support.',
    icon: '📝',
    displayOrder: 8,
    availableActions: ['create_mom_entry', 'convert_to_malayalam', 'edit_translation', 'save_mom_record', 'attach_malayalam_instruction', 'view_mom_history'],
  },
  {
    moduleKey: 'safety_checklist',
    moduleName: 'Smart Attendance & Safety Checklist',
    description: 'End-of-day safety verification before Turf Manager logout with permanent records.',
    icon: '🛡️',
    displayOrder: 9,
    availableActions: ['complete_safety_checklist', 'confirm_logout'],
  },
  {
    moduleKey: 'audit_log',
    moduleName: 'Audit & Activity Log',
    description: 'Permanent, tamper-proof record of every action taken by every user across the system.',
    icon: '📋',
    displayOrder: 10,
    availableActions: ['view_audit_logs', 'search_filter_logs', 'export_audit_report'],
  },
];

const DEMO_PORTAL_USERS = [
  {
    name: 'Committee Demo',
    email: 'committee@ovalturf.com',
    phone: '+911111111111',
    password: 'Committee@123',
    userType: 'management',
    portalType: 'committee',
  },
  {
    name: 'Turf Demo',
    email: 'turf@ovalturf.com',
    phone: '+912222222222',
    password: 'Turf@123',
    userType: 'staff',
    portalType: 'turf',
  },
  {
    name: 'Shareholder Demo',
    email: 'shareholder@ovalturf.com',
    phone: '+913333333333',
    password: 'Shareholder@123',
    userType: 'management',
    portalType: 'shareholder',
  },
] as const;

// ---- Main Seed ----
async function seed() {
  console.log('🌱 Starting OMS database seed...\n');

  await mongoose.connect(MONGODB_URI!, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });
  console.log('✅ Connected to MongoDB\n');

  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  const ModuleConfig = mongoose.models.ModuleConfig || mongoose.model('ModuleConfig', ModuleConfigSchema);

  // 1. Seed SuperAdmin
  const superadminEmail = process.env.SUPERADMIN_EMAIL || 'admin@ovalturf.com';
  const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'Admin@123';
  const hashedPassword = await bcrypt.hash(superadminPassword, 12);

  const existingSA = await User.findOne({ email: superadminEmail });
  if (existingSA) {
    if (existingSA.mustChangePassword) {
      existingSA.mustChangePassword = false;
      await existingSA.save();
    }
    console.log(`ℹ️  SuperAdmin already exists: ${superadminEmail}`);
  } else {
    await User.create({
      name: 'Super Admin',
      email: superadminEmail,
      phone: '+910000000000',
      password: hashedPassword,
      userType: 'superadmin',
      portalType: 'superadmin',
      isActive: true,
      isArchived: false,
      mustChangePassword: false,
    });
    console.log(`✅ SuperAdmin created: ${superadminEmail}`);
    console.log(`   Password: ${superadminPassword}`);
  }

  // 2. Seed demo portal users
  console.log('\nSeeding demo portal users...');
  for (const demoUser of DEMO_PORTAL_USERS) {
    await User.findOneAndUpdate(
      { email: demoUser.email },
      {
        $set: {
          name: demoUser.name,
          phone: demoUser.phone,
          password: await bcrypt.hash(demoUser.password, 12),
          userType: demoUser.userType,
          portalType: demoUser.portalType,
          isActive: true,
          isArchived: false,
          mustChangePassword: false,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`   ${demoUser.portalType}: ${demoUser.email} / ${demoUser.password}`);
  }

  // 3. Seed Module Configurations
  console.log('\n📦 Seeding module configurations...');
  for (const mod of MODULE_DEFINITIONS) {
    await ModuleConfig.findOneAndUpdate(
      { moduleKey: mod.moduleKey },
      { $set: mod },
      { upsert: true, new: true }
    );
    console.log(`   ✅ ${mod.icon} ${mod.moduleName}`);
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   SuperAdmin: ${superadminEmail}`);
  console.log(`   Committee: ${DEMO_PORTAL_USERS[0].email}`);
  console.log(`   Turf: ${DEMO_PORTAL_USERS[1].email}`);
  console.log(`   Shareholder: ${DEMO_PORTAL_USERS[2].email}`);
  console.log(`   Modules: ${MODULE_DEFINITIONS.length} registered`);
  console.log('\n🚀 You can now start the dev server with: npm run dev');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
