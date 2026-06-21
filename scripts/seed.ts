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
  positionId: { type: String, ref: 'Position', default: null },
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
    moduleKey: 'inventory',
    moduleName: 'Inventory',
    description: 'Store and track turf items, equipment, and ground assets.',
    icon: '📦',
    displayOrder: 3,
    availableActions: ['add_turf_inventory_item', 'update_turf_inventory_item', 'view_turf_inventory', 'export_turf_inventory_report'],
  },
  {
    moduleKey: 'inventory_sales',
    moduleName: 'Sales',
    description: 'Product listing, sales entries with auto-decrement, and restocking.',
    icon: '📦',
    displayOrder: 4,
    availableActions: ['log_sale', 'add_restock_entry', 'view_inventory_levels', 'set_low_stock_threshold', 'export_inventory_report'],
  },
  {
    moduleKey: 'maintenance_tasks',
    moduleName: 'Maintenance & Tasks',
    description: 'Track physical maintenance issues from identification to resolution and closure.',
    icon: '🔧',
    displayOrder: 5,
    availableActions: ['create_task', 'edit_task', 'assign_task', 'update_task_status', 'close_task', 'reopen_task', 'delete_task', 'view_all_tasks'],
  },
  {
    moduleKey: 'daily_operations',
    moduleName: 'Daily Operations & Staff Checklist',
    description: 'Daily verification of ground-level duties with live photo proof and supervisor approval.',
    icon: '✅',
    displayOrder: 6,
    availableActions: ['view_checklist', 'upload_checklist', 'verify_checklist', 'approve_checklist', 'reject_checklist', 'edit_checklist'],
  },
  {
    moduleKey: 'notifications',
    moduleName: 'Notifications & Communication',
    description: 'Real-time alerts delivered to users when relevant events occur across the system.',
    icon: '🔔',
    displayOrder: 7,
    availableActions: ['configure_notification_rules', 'manage_channels', 'view_notification_log'],
  },
  {
    moduleKey: 'reports_analytics',
    moduleName: 'Reports & Analytics',
    description: 'Real-time dashboards and exportable reports across all operational modules.',
    icon: '📊',
    displayOrder: 8,
    availableActions: ['view_dashboards', 'export_report', 'schedule_report_delivery'],
  },
  {
    moduleKey: 'malayalam_mom',
    moduleName: 'Malayalam Output & MOM',
    description: 'Minutes of Meeting documentation with English-to-Malayalam translation support.',
    icon: '📝',
    displayOrder: 9,
    availableActions: ['create_mom_entry', 'convert_to_malayalam', 'edit_translation', 'save_mom_record', 'attach_malayalam_instruction', 'view_mom_history'],
  },
  {
    moduleKey: 'safety_checklist',
    moduleName: 'Smart Attendance & Safety Checklist',
    description: 'End-of-day safety verification before Turf Manager logout with permanent records.',
    icon: '🛡️',
    displayOrder: 10,
    availableActions: ['complete_safety_checklist', 'confirm_logout'],
  },
  {
    moduleKey: 'audit_log',
    moduleName: 'Audit & Activity Log',
    description: 'Permanent, tamper-proof record of every action taken by every user across the system.',
    icon: '📋',
    displayOrder: 11,
    availableActions: ['view_audit_logs', 'search_filter_logs', 'export_audit_report'],
  },
];

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
    if (existingSA._id.toString() !== '000000000000000000000001') {
      console.log('🔄 SuperAdmin has old ID. Recreating with static ID...');
      await User.deleteOne({ email: superadminEmail });
      await User.create({
        _id: new mongoose.Types.ObjectId('000000000000000000000001'),
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
      console.log(`✅ SuperAdmin recreated with static ID: ${superadminEmail}`);
    } else {
      if (existingSA.mustChangePassword) {
        existingSA.mustChangePassword = false;
        await existingSA.save();
      }
      console.log(`ℹ️  SuperAdmin already exists with correct static ID: ${superadminEmail}`);
    }
  } else {
    await User.create({
      _id: new mongoose.Types.ObjectId('000000000000000000000001'),
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

  // 2. Seed Module Configurations
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
  console.log(`   Modules: ${MODULE_DEFINITIONS.length} registered`);
  console.log('\n🚀 You can now start the dev server with: npm run dev');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
