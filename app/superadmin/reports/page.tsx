'use client';

import { useState, useEffect } from 'react';
import { Download, AlertCircle, IndianRupee, CalendarCheck, CheckCircle, Package, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { generatePDF } from '@/lib/pdfGenerator';

export default function MasterReportDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Global Date Filter (Though engine endpoint currently returns live today + anomalies by default.
  // In a full implementation, the engine endpoint would accept this filter and aggregate data).
  const [globalFilter, setGlobalFilter] = useState('all');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchMasterData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/engine`);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          setErrorMsg(result.message || 'Failed to fetch report');
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchMasterData();
  }, [globalFilter]);

  if (loading) return <div className="page-container"><div className="spinner"></div></div>;
  if (errorMsg) return <div className="page-container"><h2>Error Loading Report:</h2><p>{errorMsg}</p></div>;
  if (!data) return <div className="page-container">Failed to load master report.</div>;

  return (
    <div className="page-container" id="report-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Master Report Dashboard</h1>
          <p className="page-subtitle">Consolidated view of all modules and critical anomalies.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select 
            className="input" 
            value={globalFilter} 
            onChange={(e) => setGlobalFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Time</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Year 2026</option>
          </select>
          <button className="btn btn-primary" onClick={() => generatePDF({
            title: 'Master Consolidated Report',
            dateRange: globalFilter === 'all' ? 'All Time' : globalFilter === 'month' ? 'Last 30 Days' : 'Year 2026',
            metrics: [
              { label: 'Today\'s Revenue', value: `Rs. ${data.live?.todayRevenue || 0}` },
              { label: 'Today\'s Bookings', value: data.live?.todayBookings || 0 },
              { label: 'Pending Maintenance', value: data.live?.pendingTasks || 0 }
            ],
            anomalies: data.anomalies?.map((a: any) => ({
              title: `[${a.type}] ${a.title}`,
              description: a.description,
              severity: a.severity
            }))
          })}>
            <Download size={16} /> Export Master PDF
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Today&apos;s Live Metrics</h2>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--success-50)', color: 'var(--success-500)' }}>
            <IndianRupee size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Today's Revenue</h3>
            <p className="metric-value">₹{data.live?.todayRevenue?.toLocaleString() || 0}</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-500)' }}>
            <CalendarCheck size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Today's Bookings</h3>
            <p className="metric-value">{data.live?.todayBookings || 0}</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--warning-50)', color: 'var(--warning-500)' }}>
            <CheckCircle size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Pending Maintenance Tasks</h3>
            <p className="metric-value">{data.live?.pendingTasks || 0}</p>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '2rem 0 1rem', color: 'var(--text-primary)' }}>Module Details</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Link href="/superadmin/reports/accounts" style={{ display: 'block', textDecoration: 'none' }}>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'var(--success-50)', color: 'var(--success-500)', padding: '0.5rem', borderRadius: '50%' }}><IndianRupee size={20} /></div>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Accounts Report</span>
            </div>
            <ArrowRight size={18} color="var(--text-secondary)" />
          </div>
        </Link>
        <Link href="/superadmin/reports/sales" style={{ display: 'block', textDecoration: 'none' }}>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'var(--primary-50)', color: 'var(--primary-500)', padding: '0.5rem', borderRadius: '50%' }}><CalendarCheck size={20} /></div>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Sales Report</span>
            </div>
            <ArrowRight size={18} color="var(--text-secondary)" />
          </div>
        </Link>
        <Link href="/superadmin/reports/maintenance" style={{ display: 'block', textDecoration: 'none' }}>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'var(--warning-50)', color: 'var(--warning-500)', padding: '0.5rem', borderRadius: '50%' }}><CheckCircle size={20} /></div>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Maintenance Report</span>
            </div>
            <ArrowRight size={18} color="var(--text-secondary)" />
          </div>
        </Link>
        <Link href="/superadmin/reports/inventory" style={{ display: 'block', textDecoration: 'none' }}>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'var(--danger-50)', color: 'var(--danger-500)', padding: '0.5rem', borderRadius: '50%' }}><Package size={20} /></div>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Inventory Report</span>
            </div>
            <ArrowRight size={18} color="var(--text-secondary)" />
          </div>
        </Link>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <div className="card">
          <h2 className="card-title">Active Anomalies & Alerts</h2>
          {!data.anomalies || data.anomalies.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>All clear! No active anomalies detected.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              {data.anomalies.map((anomaly: any) => (
                <div key={anomaly._id} style={{ 
                  padding: '0.75rem', 
                  border: `1px solid var(--${anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'danger' : 'warning'}-100)`, 
                  background: `var(--${anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'danger' : 'warning'}-50)`, 
                  borderRadius: 'var(--radius-md)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <AlertCircle size={16} color={`var(--${anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'danger' : 'warning'}-500)`} style={{ marginTop: '2px' }} />
                    <div>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: `var(--${anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'danger' : 'warning'}-700)` }}>
                        [{anomaly.type.replace('_', ' ').toUpperCase()}] {anomaly.title}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: `var(--${anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'danger' : 'warning'}-600)`, marginTop: '0.25rem' }}>{anomaly.description}</p>
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
