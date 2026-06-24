'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { Check, X, ShieldAlert, CheckCircle, XCircle, Clock, MapPin, Navigation } from 'lucide-react';

export default function CommitteeAttendance() {
  const { checkPermission } = usePermissions();
  const canVerify = checkPermission('smart_attendance', 'verify_attendance');
  const canView = checkPermission('smart_attendance', 'view_attendance_reports');
  const canSubmit = checkPermission('smart_attendance', 'submit_attendance');

  const [activeTab, setActiveTab] = useState<'submit' | 'verify'>(
    canSubmit && !canVerify ? 'submit' : 'verify'
  );

  const [loading, setLoading] = useState(false);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  // Submit states
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [targetLocation, setTargetLocation] = useState<{lat: number, lng: number} | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

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
    if (activeTab === 'verify' && (canVerify || canView)) {
      fetchAttendances();
    }
    if (activeTab === 'submit' && canSubmit) {
      checkStatus();
    }
  }, [canVerify, canView, activeTab, canSubmit]);

  const checkStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch('/api/attendance/status');
      const data = await res.json();
      if (data.success) {
        setHasSubmitted(data.data.hasSubmittedToday);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingStatus(false);
    }
  };

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

  const handleMarkAttendance = () => {
    setLocating(true);
    setLocationError(null);
    setTargetLocation(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocating(false);
        setLoading(true);
        try {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast('Attendance submitted successfully! Wait for verification.');
            setHasSubmitted(true);
          } else {
            setLocationError(data.message);
            if (data.outOfBounds && data.targetLocation) {
              setTargetLocation(data.targetLocation);
            }
          }
        } catch (e) {
          setLocationError('Failed to submit attendance.');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLocating(false);
        let msg = 'Failed to get location.';
        switch(error.code) {
          case error.PERMISSION_DENIED: msg = 'Location access denied. Please allow location access in your browser.'; break;
          case error.POSITION_UNAVAILABLE: msg = 'Location information is unavailable.'; break;
          case error.TIMEOUT: msg = 'The request to get user location timed out.'; break;
        }
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (!canVerify && !canView && !canSubmit) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: 'var(--danger-main)', margin: '0 auto var(--space-4)' }} />
          <h2>Access Denied</h2>
          <p className="page-subtitle">You do not have permission to view, submit, or verify attendance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      
      <div className="page-header" style={{ marginBottom: canSubmit && (canVerify || canView) ? 'var(--space-4)' : 'var(--space-6)' }}>
        <div>
          <h1>Smart Attendance</h1>
          <p className="page-subtitle">Manage geofenced attendance submissions and verifications.</p>
        </div>
      </div>

      {canSubmit && (canVerify || canView) && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-2)' }}>
          {canSubmit && (
            <button
              className={`btn ${activeTab === 'submit' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setActiveTab('submit')}
            >
              Submit Attendance
            </button>
          )}
          {(canVerify || canView) && (
            <button
              className={`btn ${activeTab === 'verify' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setActiveTab('verify')}
            >
              Verify Attendance
            </button>
          )}
        </div>
      )}

      {activeTab === 'submit' && canSubmit && (
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', 
              background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-6)'
            }}>
              <MapPin size={40} />
            </div>

            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Check-in Location Required</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
              Your device will request location access to verify you are within the designated Oval Turf radius.
            </p>

            {locationError && (
              <div style={{ padding: 'var(--space-3)', background: 'var(--danger-soft)', color: 'var(--danger-main)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-6)' }}>
                {locationError}
                {targetLocation && (
                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${targetLocation.lat},${targetLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <MapPin size={14} /> Get Directions
                    </a>
                  </div>
                )}
              </div>
            )}

            {checkingStatus ? (
              <div style={{ padding: 'var(--space-4)' }}><div className="spinner spinner-md" style={{ margin: '0 auto' }} /></div>
            ) : hasSubmitted ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--success-soft)', color: 'var(--success-main)', borderRadius: 'var(--radius-md)' }}>
                <CheckCircle size={32} style={{ margin: '0 auto var(--space-2)' }} />
                <h3 style={{ fontSize: 'var(--text-md)', marginBottom: '4px' }}>Already Submitted</h3>
                <p style={{ fontSize: 'var(--text-xs)' }}>You have already marked your attendance today.</p>
              </div>
            ) : (
              <button 
                className={`btn btn-primary btn-lg ${locating || loading ? 'btn-loading' : ''}`} 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleMarkAttendance}
                disabled={locating || loading}
              >
                <Navigation size={18} />
                {locating ? 'Acquiring GPS...' : loading ? 'Submitting...' : 'Mark Attendance'}
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'verify' && (canVerify || canView) && (
        <div className="card" style={{ padding: 0 }}>
          {loading && attendances.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <div className="spinner spinner-md" style={{ margin: '0 auto var(--space-4)' }} />
              <p className="page-subtitle">Loading submissions...</p>
            </div>
          ) : attendances.length === 0 ? (
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
      )}
    </div>
  );
}
