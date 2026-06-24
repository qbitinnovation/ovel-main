'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { MapPin, Check, X, ShieldAlert, Navigation, CheckCircle } from 'lucide-react';

export default function SuperAdminSubmitAttendance() {
  const { checkPermission } = usePermissions();
  const canSubmit = checkPermission('smart_attendance', 'submit_attendance');

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  
  const [locationError, setLocationError] = useState<string | null>(null);
  const [targetLocation, setTargetLocation] = useState<{lat: number, lng: number} | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    checkStatus();
  }, []);

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

  if (!canSubmit) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: 'var(--danger-main)', margin: '0 auto var(--space-4)' }} />
          <h2>Access Denied</h2>
          <p className="page-subtitle">You do not have permission to submit attendance.</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      
      <div className="page-header">
        <div>
          <h1>Submit Attendance</h1>
          <p className="page-subtitle">Mark your daily presence within the designated geofence zone.</p>
        </div>
      </div>

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
    </div>
  );
}
