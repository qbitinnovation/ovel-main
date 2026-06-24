'use client';

import { useState, useEffect } from 'react';
import { Download, AlertCircle, Clock, CalendarCheck, ArrowLeft, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { generatePDF } from '@/lib/pdfGenerator';

export default function SalesReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/sales?filter=${filter}`);
        const result = await res.json();
        if (result.success) setData(result.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [filter]);

  if (loading) return <div className="page-container"><div className="spinner"></div></div>;
  if (!data) return <div className="page-container">Failed to load report.</div>;

  return (
    <div className="page-container" id="report-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/superadmin/reports" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </Link>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Sales & Bookings Report</h1>
          <p className="page-subtitle">Total turf usage, peak hours, and sales drops.</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <select 
            className="input" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <button className="btn btn-primary" onClick={() => generatePDF({
            title: 'Sales & Bookings Report',
            dateRange: filter === 'all' ? 'All Time' : filter === 'month' ? 'This Month' : 'This Year',
            metrics: [
              { label: 'Total Bookings', value: data.totalBookings },
              { label: 'Total Usage Hours', value: `${data.totalUsageHours.toFixed(1)} hrs` },
              { label: 'Peak Booking Hour', value: data.peakHour }
            ],
            anomalies: data.salesDrops.map((a: any) => ({
              title: a.title,
              description: a.description,
              severity: a.severity
            }))
          })}>
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-500)' }}>
            <CalendarCheck size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Total Bookings</h3>
            <p className="metric-value">{data.totalBookings}</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--success-50)', color: 'var(--success-500)' }}>
            <Clock size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Total Usage Hours</h3>
            <p className="metric-value">{data.totalUsageHours.toFixed(1)} hrs</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--warning-50)', color: 'var(--warning-500)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Peak Booking Hour</h3>
            <p className="metric-value">{data.peakHour}</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {/* Anomalies Card */}
        <div className="card">
          <h2 className="card-title">Sales Drop Alerts</h2>
          {data.salesDrops.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>No sales drops detected recently.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              {data.salesDrops.map((anomaly: any) => (
                <div key={anomaly._id} style={{ padding: '0.75rem', border: '1px solid var(--danger-100)', background: 'var(--danger-50)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <AlertCircle size={16} color="var(--danger-500)" style={{ marginTop: '2px' }} />
                    <div>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--danger-700)' }}>{anomaly.title}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--danger-600)', marginTop: '0.25rem' }}>{anomaly.description}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--danger-500)', marginTop: '0.25rem' }}>
                        Detected: {new Date(anomaly.detectedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
