'use client';

import { useState, useEffect } from 'react';
import { Download, AlertCircle, TrendingUp, IndianRupee, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { generatePDF } from '@/lib/pdfGenerator';

export default function AccountsReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/accounts?filter=${filter}`);
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

  const maxRevenue = Math.max(data.thisMonthRevenue, data.lastMonthRevenue, 1);
  const thisMonthHeight = (data.thisMonthRevenue / maxRevenue) * 100;
  const lastMonthHeight = (data.lastMonthRevenue / maxRevenue) * 100;

  return (
    <div className="page-container" id="report-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/superadmin/reports" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </Link>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Accounts & Finance Report</h1>
          <p className="page-subtitle">Revenue, outstanding balances, and payment anomalies.</p>
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
            title: 'Accounts & Finance Report',
            dateRange: filter === 'all' ? 'All Time' : filter === 'month' ? 'This Month' : 'This Year',
            metrics: [
              { label: 'Total Revenue', value: `Rs. ${data.totalRevenue}` },
              { label: 'Outstanding Balances', value: `Rs. ${data.outstandingBalances}` },
              { label: 'This Month Revenue', value: `Rs. ${data.thisMonthRevenue}` },
              { label: 'Last Month Revenue', value: `Rs. ${data.lastMonthRevenue}` }
            ],
            anomalies: data.latePayments.map((a: any) => ({
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
          <div className="metric-icon" style={{ background: 'var(--success-50)', color: 'var(--success-500)' }}>
            <IndianRupee size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Total Revenue</h3>
            <p className="metric-value">₹{data.totalRevenue.toLocaleString()}</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--warning-50)', color: 'var(--warning-500)' }}>
            <AlertCircle size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Outstanding Balances</h3>
            <p className="metric-value">₹{data.outstandingBalances.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* Chart Card */}
        <div className="card">
          <h2 className="card-title">Month over Month Revenue</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '200px', gap: '2rem', padding: '1rem 0', marginTop: '1rem' }}>
            
            {/* Last Month Bar */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>₹{data.lastMonthRevenue.toLocaleString()}</span>
              <div style={{ 
                width: '60px', 
                height: `${lastMonthHeight}%`, 
                background: 'var(--primary-200)', 
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.3s ease'
              }}></div>
              <span style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Last Month</span>
            </div>

            {/* This Month Bar */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>₹{data.thisMonthRevenue.toLocaleString()}</span>
              <div style={{ 
                width: '60px', 
                height: `${thisMonthHeight}%`, 
                background: 'var(--primary-500)', 
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.3s ease'
              }}></div>
              <span style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>This Month</span>
            </div>

          </div>
        </div>

        {/* Anomalies Card */}
        <div className="card">
          <h2 className="card-title">Late Payment Alerts</h2>
          {data.latePayments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>No late payments detected.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              {data.latePayments.map((anomaly: any) => (
                <div key={anomaly._id} style={{ padding: '0.75rem', border: '1px solid var(--danger-100)', background: 'var(--danger-50)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <AlertCircle size={16} color="var(--danger-500)" style={{ marginTop: '2px' }} />
                    <div>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--danger-700)' }}>{anomaly.title}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--danger-600)', marginTop: '0.25rem' }}>{anomaly.description}</p>
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
