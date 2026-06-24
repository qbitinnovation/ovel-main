'use client';

import { useState, useEffect } from 'react';
import { Download, AlertCircle, Package, TrendingDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { generatePDF } from '@/lib/pdfGenerator';

export default function InventoryReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/inventory?filter=${filter}`);
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
          <h1 className="page-title">Inventory Report</h1>
          <p className="page-subtitle">Track stock levels and usage rate.</p>
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
            title: 'Inventory Report',
            dateRange: filter === 'all' ? 'All Time' : filter === 'month' ? 'This Month' : 'This Year',
            metrics: [
              { label: 'Total Unique Items', value: data.totalItems },
              { label: 'Total Usage Rate', value: data.totalUsage },
              { label: 'Low Stock Alerts', value: data.lowStockItems.length }
            ],
            tables: [{
              title: 'Low Stock Items',
              headers: ['Item Name', 'Category', 'Current Stock', 'Min Stock'],
              rows: data.lowStockItems.map((item: any) => [item.itemName, item.category, item.currentStock, item.minimumStock])
            }]
          })}>
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-500)' }}>
            <Package size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Total Unique Items</h3>
            <p className="metric-value">{data.totalItems}</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--success-50)', color: 'var(--success-500)' }}>
            <TrendingDown size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Total Usage Rate (Units Sold)</h3>
            <p className="metric-value">{data.totalUsage}</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--danger-50)', color: 'var(--danger-500)' }}>
            <AlertCircle size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-title">Low Stock Alerts</h3>
            <p className="metric-value">{data.lowStockItems.length}</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <h2 className="card-title">Low Stock Items</h2>
          {data.lowStockItems.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>No items are currently low on stock.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              {data.lowStockItems.map((item: any) => (
                <div key={item._id} style={{ padding: '0.75rem', border: '1px solid var(--warning-100)', background: 'var(--warning-50)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <AlertCircle size={16} color="var(--warning-600)" style={{ marginTop: '2px' }} />
                    <div>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--warning-800)' }}>{item.itemName}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--warning-700)', marginTop: '0.25rem' }}>Category: {item.category}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--danger-600)' }}>{item.currentStock}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Min: {item.minimumStock}</p>
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
