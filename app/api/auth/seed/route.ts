import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import ModuleConfig from '@/models/ModuleConfig';
import bcrypt from 'bcryptjs';

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

export async function GET() {
  try {
    console.log('🌱 Starting API-triggered database seed...');
    await dbConnect();
    console.log('✅ Connected to MongoDB via API');

    // 1. Seed SuperAdmin
    const superadminEmail = process.env.SUPERADMIN_EMAIL || 'admin@ovalturf.com';
    const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'Admin@123';
    const hashedPassword = await bcrypt.hash(superadminPassword, 12);

    const existingSA = await User.findOne({ email: superadminEmail });
    let saStatus = '';
    if (existingSA) {
      if (existingSA.mustChangePassword) {
        existingSA.mustChangePassword = false;
        await existingSA.save();
      }
      saStatus = `SuperAdmin already exists: ${superadminEmail}`;
      console.log(`ℹ️  ${saStatus}`);
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
      saStatus = `SuperAdmin created: ${superadminEmail}`;
      console.log(`✅ ${saStatus}`);
    }

    // 2. Seed Module Configurations
    console.log('📦 Seeding module configurations...');
    for (const mod of MODULE_DEFINITIONS) {
      await ModuleConfig.findOneAndUpdate(
        { moduleKey: mod.moduleKey },
        { $set: mod },
        { upsert: true, new: true }
      );
      console.log(`   ✅ ${mod.icon} ${mod.moduleName}`);
    }

    console.log('🎉 Seed completed successfully!');
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      superadmin: saStatus,
      modulesSeeded: MODULE_DEFINITIONS.length
    });
  } catch (error: any) {
    console.error('❌ Seed failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
