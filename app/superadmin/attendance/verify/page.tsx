'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { Check, X, ShieldAlert, CheckCircle, XCircle, Clock, MapPin } from 'lucide-react';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';

export default function SuperAdminVerifyAttendance() {
  const { checkPermission } = usePermissions();
  const canVerify = checkPermission('smart_attendance', 'verify_attendance');
  const canView = checkPermission('smart_attendance', 'view_attendance_reports');

  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance?today=true');
      const data = await res.json();
      if (data.success) {
        setAttendances(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canVerify || canView) {
      fetchAttendances();
    }
  }, [canVerify, canView]);

  const handleVerify = async (id: string, status: 'verified' | 'rejected') => {
    if (!canVerify) return;
    try {
      const res = await fetch('/api/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Attendance ${status} successfully`);
        fetchAttendances();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast(`Error updating attendance`, 'error');
    }
  };

  if (!canVerify && !canView) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: 'var(--danger-main)', margin: '0 auto var(--space-4)' }} />
          <h2>Access Denied</h2>
          <p className="page-subtitle">You do not have permission to view or verify attendance.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="page-container"><div className="loading-screen"><div className="spinner spinner-lg" /></div></div>;
  }

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      
      <div className="page-header">
        <div>
          <h1>Verify Attendance</h1>
          <p className="page-subtitle">Review and verify geofenced attendance submissions.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {attendances.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CheckCircle size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.5 }} />
            <h3>All caught up!</h3>
            <p>There are no pending attendance submissions to verify.</p>
          </div>
        ) : (
          <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-glass-border)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>
                  <th style={{ padding: 'var(--space-4)' }}>Staff Member</th>
                  <th style={{ padding: 'var(--space-4)' }}>Timestamp</th>
                  <th style={{ padding: 'var(--space-4)' }}>Location (Distance)</th>
                  <th style={{ padding: 'var(--space-4)' }}>Status</th>
                  {canVerify && <th style={{ padding: 'var(--space-4)' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {attendances.map(record => (
                  <tr key={record._id} style={{ borderBottom: '1px solid var(--surface-glass-border)' }}>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{record.userId?.name || 'Unknown User'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{record.userId?.email}</div>
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Clock size={14} />
                        {new Date(record.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        <MapPin size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>{Math.round(record.distance)}m away from center</span>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      {record.status === 'pending' && <span className="badge badge-warning badge-dot">Pending</span>}
                      {record.status === 'verified' && <span className="badge badge-success badge-dot">Verified</span>}
                      {record.status === 'rejected' && <span className="badge badge-danger badge-dot">Rejected</span>}
                    </td>
                    {canVerify && (
                      <td style={{ padding: 'var(--space-4)' }}>
                        {record.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn btn-sm btn-ghost" 
                              onClick={() => handleVerify(record._id, 'verified')}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-success)', padding: '4px 8px' }}
                            >
                              <CheckCircle size={16} /> Approve
                            </button>
                            <button 
                              className="btn btn-sm btn-ghost" 
                              onClick={() => handleVerify(record._id, 'rejected')}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-danger)', padding: '4px 8px' }}
                            >
                              <XCircle size={16} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            Processed by <span style={{ fontWeight: 500 }}>{record.verifiedBy?.name || 'Unknown'}</span>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
