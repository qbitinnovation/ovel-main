import dbConnect from '@/lib/db';
import { isDevFallbackEnabled, getDevStore } from '@/lib/dev-store';
import { auth } from '@/lib/auth';
import { getUserModuleAccess } from '@/lib/permissions';
import User from '@/models/User';
import Booking from '@/models/Booking';
import InventoryItem from '@/models/InventoryItem';
import MaintenanceTask from '@/models/MaintenanceTask';
import Checklist from '@/models/Checklist';
import PortalModuleMapping from '@/models/PortalModuleMapping';
import Feedback from '@/models/Feedback';
import { ChevronRight, Wrench, Wallet, MessageSquareWarning, Lock } from 'lucide-react';
import Link from 'next/link';

interface PortalDashboardProps {
  portalName: string;
  portalBase: string;
}

export default async function PortalDashboard({ portalName, portalBase }: PortalDashboardProps) {
  const session = await auth();
  const userName = session?.user?.name || portalName;

  const accessList = session?.user?.id ? await getUserModuleAccess(session.user.id) : [];
  
  const hasAccess = (moduleKey: string) => {
    return accessList.some(m => m.moduleKey === moduleKey);
  };

  const hasBookingsAccess = hasAccess('bookings');
  const hasUsersAccess = hasAccess('users');
  const hasMaintenanceAccess = hasAccess('maintenance') || hasAccess('checklists');
  const hasAccountsAccess = hasAccess('accounts');
  const hasFeedbackAccess = hasAccess('feedback');

  let totalUsers = 0;
  let activeBookings = 0;
  let inventoryAlerts = 0;
  let maintenanceTasks = 0;
  let checklists = 0;
  let activeModules = 0;
  let activeFeedback = 0;

  try {
    await dbConnect();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [uCount, bCount, iCount, mCount, cCount, modCount, compCount] = await Promise.all([
      hasUsersAccess ? User.countDocuments({ isActive: true, isArchived: false }) : Promise.resolve(0),
      hasBookingsAccess ? Booking.countDocuments({ bookingStatus: 'confirmed', bookingDate: { $gte: today } }) : Promise.resolve(0),
      InventoryItem.countDocuments({ $expr: { $lte: ['$currentStock', '$lowStockThreshold'] } }),
      hasMaintenanceAccess ? MaintenanceTask.countDocuments({ status: { $ne: 'completed' } }) : Promise.resolve(0),
      hasMaintenanceAccess ? Checklist.countDocuments({ status: 'pending' }) : Promise.resolve(0),
      PortalModuleMapping.countDocuments({ isActive: true }),
      hasFeedbackAccess ? Feedback.countDocuments({ status: { $in: ['open', 'in_progress'] } }) : Promise.resolve(0)
    ]);
    
    totalUsers = uCount;
    activeBookings = bCount;
    inventoryAlerts = iCount;
    maintenanceTasks = mCount;
    checklists = cCount;
    activeModules = modCount;
    activeFeedback = compCount;
  } catch (error) {
    if (isDevFallbackEnabled()) {
      const store = getDevStore();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      totalUsers = hasUsersAccess ? store.users?.filter(u => u.isActive && !u.isArchived).length || 0 : 0;
      activeBookings = hasBookingsAccess ? store.bookings?.filter(b => b.bookingStatus === 'confirmed' && new Date(b.bookingDate) >= today).length || 0 : 0;
      inventoryAlerts = store.inventoryItems?.filter(i => i.currentStock <= i.lowStockThreshold).length || 0;
      maintenanceTasks = hasMaintenanceAccess ? store.maintenanceTasks?.filter(m => m.status !== 'completed').length || 0 : 0;
      checklists = hasMaintenanceAccess ? store.checklists?.filter(c => c.overallStatus === 'pending').length || 0 : 0;
      activeModules = store.portalMappings?.filter((m: any) => m.isActive).length || 0;
      activeFeedback = hasFeedbackAccess ? store.feedbacks?.filter(f => f.status === 'open' || f.status === 'in_progress').length || 0 : 0;
    } else {
      console.error('Failed to fetch dashboard metrics:', error);
    }
  }

  return (
    <div className="page-container">
      
      {/* Header Profile Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Welcome back,</div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: '700', color: 'var(--text-primary)' }}>{userName}</div>
        </div>
      </div>

      {/* Black Premium Banner */}
      {hasBookingsAccess ? (
        <Link href={`${portalBase}/bookings/manage`} style={{ textDecoration: 'none' }}>
          <div style={{ 
            background: 'var(--accent-primary)', 
            borderRadius: '16px', padding: 'var(--space-3) var(--space-5)', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            marginBottom: 'var(--space-6)', boxShadow: 'var(--shadow-sm)',
            color: 'var(--accent-primary-text)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ fontSize: '20px' }}>⚡</div>
              <div>
                <div style={{ fontWeight: '600', fontSize: 'var(--text-base)' }}>Go booking</div>
                <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>Manage your active and upcoming slots</div>
              </div>
            </div>
            <div style={{ 
              width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-primary)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              <ChevronRight size={16} color="var(--accent-primary-text)" />
            </div>
          </div>
        </Link>
      ) : (
        <div style={{ 
          background: 'var(--accent-primary)', 
          borderRadius: '16px', padding: 'var(--space-3) var(--space-5)', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          marginBottom: 'var(--space-6)', boxShadow: 'var(--shadow-sm)',
          color: 'var(--accent-primary-text)', opacity: 0.6, cursor: 'not-allowed'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: '20px' }}>🔒</div>
            <div>
              <div style={{ fontWeight: '600', fontSize: 'var(--text-base)' }}>Bookings Locked</div>
              <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>No access to this module</div>
            </div>
          </div>
          <div style={{ 
            width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-primary)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            <Lock size={14} color="var(--accent-primary-text)" />
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '500', color: 'var(--text-primary)', marginBottom: 'var(--space-4)', letterSpacing: '-0.5px' }}>
        Dashboard Overview
      </h2>

      {/* 2 Top Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        
        {/* Card 1: Bookings */}
        {hasBookingsAccess ? (
          <Link href={`${portalBase}/bookings/manage`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ borderRadius: '24px', padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.3' }}>Current &<br/>Upcoming<br/>Bookings</div>
                <ChevronRight size={18} color="var(--text-secondary)" />
              </div>
              
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '40px' }}>
                  <div style={{ width: '20px', height: '60%', background: '#f0f0f0', borderRadius: '4px' }}></div>
                  <div style={{ width: '20px', height: '40%', background: '#f0f0f0', borderRadius: '4px' }}></div>
                  <div style={{ width: '20px', height: '100%', background: '#f0f0f0', borderRadius: '4px' }}></div>
                  <div style={{ width: '20px', height: '80%', background: '#f0f0f0', borderRadius: '4px' }}></div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>{activeBookings} active slots</div>
              </div>
            </div>
          </Link>
        ) : (
          <div className="card" style={{ borderRadius: '24px', padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', border: 'none', opacity: 0.6, cursor: 'not-allowed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.3' }}>Current &<br/>Upcoming<br/>Bookings</div>
              <Lock size={16} color="var(--text-secondary)" />
            </div>
            
            <div style={{ marginTop: 'auto' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '40px' }}>
                <div style={{ width: '20px', height: '60%', background: '#f0f0f0', borderRadius: '4px' }}></div>
                <div style={{ width: '20px', height: '40%', background: '#f0f0f0', borderRadius: '4px' }}></div>
                <div style={{ width: '20px', height: '100%', background: '#f0f0f0', borderRadius: '4px' }}></div>
                <div style={{ width: '20px', height: '80%', background: '#f0f0f0', borderRadius: '4px' }}></div>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>No Access</div>
            </div>
          </div>
        )}

        {/* Card 2: Metrics */}
        {hasUsersAccess ? (
          <Link href={`${portalBase}/users`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ borderRadius: '24px', padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Operational Metrics</div>
                <ChevronRight size={18} color="var(--text-secondary)" />
              </div>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1' }}>{totalUsers}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Users</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1' }}>{inventoryAlerts}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Alerts</div>
                </div>
              </div>
              
              <div style={{ marginTop: 'auto', position: 'relative', height: '40px', width: '100%' }}>
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%', stroke: '#ccc', strokeWidth: 2, fill: 'none' }}>
                  <path d="M0 35 Q 10 30, 20 35 T 40 25 T 60 10 T 80 15 T 100 20" />
                </svg>
              </div>
            </div>
          </Link>
        ) : (
          <div className="card" style={{ borderRadius: '24px', padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', border: 'none', opacity: 0.6, cursor: 'not-allowed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Operational Metrics</div>
              <Lock size={16} color="var(--text-secondary)" />
            </div>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1' }}>-</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Users</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1' }}>-</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Alerts</div>
              </div>
            </div>
            
            <div style={{ marginTop: 'auto', position: 'relative', height: '40px', width: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>No Access</div>
            </div>
          </div>
        )}
        
      </div>

      {/* Card 3: Full Width */}
      {hasMaintenanceAccess ? (
        <div className="card" style={{ borderRadius: '24px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', border: 'none', position: 'relative', overflow: 'hidden' }}>
          <div style={{ zIndex: 1, maxWidth: '60%' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Pending Tasks</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>Maintenance & Checklists</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>Track your pending tasks and checklists. Ensure all items are completed on time.</div>
            
            <Link href={`${portalBase}/maintenance`} style={{ textDecoration: 'none' }}>
              <div className="btn btn-primary" style={{ display: 'inline-flex', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                Manage Tasks
              </div>
            </Link>
          </div>
          
          <div style={{ 
            position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)',
            width: '120px', height: '120px', borderRadius: '50%', 
            border: '1px solid #eaeaea', 
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', 
              background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
              <Wrench size={20} color="var(--text-secondary)" style={{ marginBottom: '4px' }}/>
              <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1' }}>{maintenanceTasks + checklists}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ borderRadius: '24px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', border: 'none', position: 'relative', overflow: 'hidden', opacity: 0.6 }}>
          <div style={{ zIndex: 1, maxWidth: '60%' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Pending Tasks</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>Maintenance & Checklists</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>Track your pending tasks and checklists. Ensure all items are completed on time.</div>
            
            <div className="btn" style={{ display: 'inline-flex', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}>
              <Lock size={12} style={{ marginRight: '6px' }}/> No Access
            </div>
          </div>
          
          <div style={{ 
            position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)',
            width: '120px', height: '120px', borderRadius: '50%', 
            border: '1px solid #eaeaea', 
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', 
              background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
              <Lock size={20} color="var(--text-secondary)" style={{ marginBottom: '4px' }}/>
            </div>
          </div>
        </div>
      )}

      {/* Other Modules List */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>System Modules</h3>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Manage all other operations</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hasAccountsAccess ? (
            <Link href={`${portalBase}/accounts`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' }}><Wallet size={16} color="var(--text-secondary)" /></div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Accounts & Billing</div>
                </div>
                <ChevronRight size={16} color="var(--text-secondary)" />
              </div>
            </Link>
          ) : (
            <div className="card" style={{ padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', opacity: 0.6, cursor: 'not-allowed' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' }}><Wallet size={16} color="var(--text-secondary)" /></div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Accounts & Billing</div>
              </div>
              <Lock size={14} color="var(--text-secondary)" />
            </div>
          )}

          {hasFeedbackAccess ? (
            <Link href={`${portalBase}/feedback`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' }}><MessageSquareWarning size={16} color="var(--text-secondary)" /></div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>User Feedback <span style={{ background: activeFeedback > 0 ? 'var(--status-danger)' : 'var(--bg-primary)', color: activeFeedback > 0 ? 'white' : 'var(--text-primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', marginLeft: '8px' }}>{activeFeedback}</span></div>
                </div>
                <ChevronRight size={16} color="var(--text-secondary)" />
              </div>
            </Link>
          ) : (
            <div className="card" style={{ padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', opacity: 0.6, cursor: 'not-allowed' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' }}><MessageSquareWarning size={16} color="var(--text-secondary)" /></div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>User Feedback</div>
              </div>
              <Lock size={14} color="var(--text-secondary)" />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
