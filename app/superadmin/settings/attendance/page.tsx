'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Globe, Check, X, MapPin, Search, Navigation } from 'lucide-react';
import { usePermissions } from '@/components/providers/PermissionsProvider';

export default function AttendanceSettings() {
  const { checkPermission } = usePermissions();
  const canEdit = checkPermission('smart_attendance', 'manage_geofence');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const [geofence, setGeofence] = useState({ lat: 10.0247, lng: 76.3079, radius: 50 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success) {
          const setting = data.data.find((s: any) => s.key === 'attendance_geofence');
          if (setting && setting.value) {
            setGeofence(setting.value);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        settings: [
          { key: 'attendance_geofence', value: geofence, category: 'operations' }
        ]
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Settings saved successfully');
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast('Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!canEdit) return;
    setGeofence(prev => ({ ...prev, lat, lng }));
  };

  const handleUseCurrentLocation = () => {
    if (!canEdit) return;
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeofence(prev => ({ ...prev, lat: position.coords.latitude, lng: position.coords.longitude }));
        showToast('Current location applied');
      },
      () => showToast('Unable to retrieve your location', 'error')
    );
  };

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setGeofence(prev => ({ ...prev, lat: parseFloat(lat), lng: parseFloat(lon) }));
        showToast('Location found and applied');
      } else {
        showToast('Location not found', 'error');
      }
    } catch (e) {
      showToast('Error searching location', 'error');
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return <div className="page-container"><div className="loading-screen"><div className="spinner spinner-lg" /></div></div>;
  }

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <Link href="/superadmin/settings" style={{ color: 'var(--text-secondary)' }}><ArrowLeft size={16} /></Link>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>Back to Settings</span>
          </div>
          <h1>Attendance Settings</h1>
          <p className="page-subtitle">Configure Smart Attendance geofence boundaries</p>
        </div>
        {canEdit && (
          <button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleSave} disabled={saving}>
            <Save size={16} /> Save Changes
          </button>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} style={{ color: 'var(--accent-primary)' }} /> Geofence Configuration
            </h3>
          </div>
          <div className="card-body" style={{ padding: 'var(--space-6)' }}>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input type="number" step="any" className="form-input" value={geofence.lat} onChange={(e) => setGeofence({ ...geofence, lat: parseFloat(e.target.value) || 0 })} disabled={!canEdit} />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input type="number" step="any" className="form-input" value={geofence.lng} onChange={(e) => setGeofence({ ...geofence, lng: parseFloat(e.target.value) || 0 })} disabled={!canEdit} />
              </div>
              <div className="form-group">
                <label className="form-label">Radius (meters)</label>
                <input type="number" className="form-input" value={geofence.radius} onChange={(e) => setGeofence({ ...geofence, radius: parseInt(e.target.value) || 0 })} disabled={!canEdit} />
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-2)' }}>
                <div>
                  <label className="form-label">Location Map (Pin Selection)</label>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Click on the map to drop a new pin for the attendance center.</div>
                </div>
                {canEdit && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleUseCurrentLocation} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Navigation size={14} /> Use My Current Location
                  </button>
                )}
              </div>
              
              {canEdit && (
                <form onSubmit={handleSearchLocation} style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-4)' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Search for an address or place..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className={`btn btn-primary ${searching ? 'btn-loading' : ''}`} disabled={searching || !searchQuery.trim()}>
                    <Search size={16} /> Search
                  </button>
                </form>
              )}
              
              <MapComponent geofence={geofence} onMapClick={handleMapClick} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// Map Component using raw Leaflet from CDN to avoid dependency issues
function MapComponent({ geofence, onMapClick }: { geofence: { lat: number, lng: number, radius: number }, onMapClick: (lat: number, lng: number) => void }) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      if ((window as any).L) {
        initMap();
      }
    }

    function initMap() {
      if (!mapContainerRef.current) return;
      const L = (window as any).L;
      
      // Fix default icon
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (mapRef.current) {
        mapRef.current.remove();
      }

      const map = L.map(mapContainerRef.current).setView([geofence.lat, geofence.lng], 15);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const marker = L.marker([geofence.lat, geofence.lng]).addTo(map);
      const circle = L.circle([geofence.lat, geofence.lng], {
        color: '#4f46e5',
        fillColor: '#4f46e5',
        fillOpacity: 0.2,
        radius: geofence.radius
      }).addTo(map);

      map.on('click', function(e: any) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map when geofence changes from external input
  useEffect(() => {
    const L = (window as any).L;
    if (mapRef.current && L) {
      mapRef.current.setView([geofence.lat, geofence.lng]);
      mapRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) {
          layer.setLatLng([geofence.lat, geofence.lng]);
        }
        if (layer instanceof L.Circle) {
          layer.setLatLng([geofence.lat, geofence.lng]);
          layer.setRadius(geofence.radius);
        }
      });
    }
  }, [geofence]);

  return (
    <div style={{ height: '400px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
