'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

interface ChecklistItem {
  key: string;
  label: string;
  photoUrl: string;
  capturedAt: string | null;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'unverified';
  supervisorNote: string;
}

interface ChecklistRecord {
  _id: string;
  date: string;
  items: ChecklistItem[];
  overallStatus: string;
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'badge-neutral',
  submitted: 'badge-info',
  approved: 'badge-success',
  rejected: 'badge-danger',
  unverified: 'badge-warning',
};

export default function TurfManagerChecklistPage() {
  const { data: session } = useSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [checklist, setChecklist] = useState<ChecklistRecord | null>(null);
  const [activeItem, setActiveItem] = useState<ChecklistItem | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchChecklist = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (session?.user?.id) params.set('staffId', session.user.id);
      params.set('date', new Date().toISOString());
      const res = await fetch(`/api/checklists?${params}`);
      const data = await res.json();
      if (data.success) setChecklist(data.data[0] || null);
    } catch {
      showToast('Failed to load checklist', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user) fetchChecklist();
  }, [session, fetchChecklist]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => stopCamera, []);

  const openCamera = async (item: ChecklistItem) => {
    setActiveItem(item);
    setCapturedPhoto('');
    setCameraError('');
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError('Camera access is required. Gallery uploads are disabled for checklist proof.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError('Camera is not ready yet.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.82));
  };

  const submitPhoto = async () => {
    if (!checklist || !activeItem || !capturedPhoto) return;
    setSaving(true);

    try {
      const position = await getLocation();
      const res = await fetch(`/api/checklists/${checklist._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-item',
          itemKey: activeItem.key,
          photoUrl: capturedPhoto,
          captureSource: 'camera',
          gpsLat: position?.coords.latitude || null,
          gpsLng: position?.coords.longitude || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChecklist(data.data);
        showToast('Checklist item submitted');
        closeCamera();
      } else {
        showToast(data.message || 'Failed to submit item', 'error');
      }
    } catch {
      showToast('Failed to submit item', 'error');
    } finally {
      setSaving(false);
    }
  };

  const closeCamera = () => {
    stopCamera();
    setActiveItem(null);
    setCapturedPhoto('');
    setCameraError('');
  };

  const completed = checklist?.items.filter((item) => item.status !== 'pending').length || 0;
  const total = checklist?.items.length || 0;

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Supervisor Checklist</h1>
          <p className="page-subtitle">Complete each checking item with a live camera photo</p>
        </div>
        {total > 0 && <span className="badge badge-info badge-dot">{completed}/{total} completed</span>}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : !checklist ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">No checklist available</div>
            <div className="empty-state-description">Today&apos;s supervisor checklist will appear here when generated.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {checklist.items.map((item, index) => (
            <div key={item.key} className="card">
              <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-full)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {index + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                    <span className={`badge ${STATUS_CLASS[item.status] || 'badge-neutral'} badge-dot`}>{item.status}</span>
                    {item.capturedAt && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{new Date(item.capturedAt).toLocaleString('en-IN')}</span>}
                    {item.supervisorNote && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-danger)' }}>{item.supervisorNote}</span>}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => openCamera(item)}>
                  {item.status === 'pending' ? 'Open Camera' : 'Retake'}
                </button>
              </div>
              {item.photoUrl && (
                <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                  <img src={item.photoUrl} alt={`${item.label} proof`} style={{ width: 160, maxHeight: 120, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-glass-border)' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeItem && (
        <div className="modal-backdrop" onClick={closeCamera}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Live Photo - {activeItem.label}</h3>
              <button className="modal-close" onClick={closeCamera}>×</button>
            </div>
            <div className="modal-body">
              {cameraError ? (
                <div className="login-error">{cameraError}</div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 420, background: 'black', borderRadius: 'var(--radius-lg)', objectFit: 'cover' }} />
                  {capturedPhoto && <img src={capturedPhoto} alt="Captured proof preview" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-glass-border)' }} />}
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Photos must be taken live with this camera. Gallery upload is not available.
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={closeCamera}>Cancel</button>
              {!cameraError && <button className="btn btn-secondary btn-md" onClick={capturePhoto}>Capture</button>}
              {!cameraError && (
                <button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={submitPhoto} disabled={!capturedPhoto || saving}>
                  Submit Item
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getLocation(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 3000,
      maximumAge: 30000,
    });
  });
}
