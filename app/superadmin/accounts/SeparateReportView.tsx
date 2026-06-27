import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Download, Filter } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';

export default function SeparateReportView({ 
  exportDateRange, 
  exportFromDate, 
  exportToDate,
  statusFilter,
  showToast,
  fmt
}: { 
  exportDateRange: string; 
  exportFromDate: string; 
  exportToDate: string;
  statusFilter: string;
  showToast: (m: string, t?: string) => void;
  fmt: (n: number) => string;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ bookings: [], sales: [] });
  const [filterType, setFilterType] = useState('bookings'); // bookings, sales
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/accounts/billing');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const unifiedData = useMemo(() => {
    let items: any[] = [];
    
    // Process Bookings
    data.bookings.forEach((b: any) => {
      const date = new Date(b.bookingDate || b.createdAt);
      const isPending = b.paymentStatus === 'pending' || b.paymentStatus === 'partial';
      
      // Calculate split amounts
      const totalExpected = b.expectedAmount || 0;
      const totalPaid = b.totalPaid || 0;
      const productAmount = b.productAmount || 0;
      const bookingOnlyExpected = Math.max(0, totalExpected - productAmount);
      
      // Pro-rata the paid amount
      let paidForBooking = 0;
      let paidForProducts = 0;
      if (totalPaid >= totalExpected) {
        paidForBooking = bookingOnlyExpected;
        paidForProducts = productAmount;
      } else {
        // If partially paid, let's just assign proportionally or however
        const ratio = totalExpected > 0 ? totalPaid / totalExpected : 0;
        paidForBooking = bookingOnlyExpected * ratio;
        paidForProducts = productAmount * ratio;
      }

      const user = b.createdBy as any;
      const processedBy = {
        name: user?.name || 'Admin',
        position: user?.positionId?.title || user?.userType || 'Super Admin'
      };
      
      // Add Booking Core
      items.push({
        id: `${b._id}-core`,
        date,
        type: 'Booking',
        customer: b.customerName || 'N/A',
        details: `Turf Booking`,
        expected: bookingOnlyExpected,
        paid: paidForBooking,
        pending: Math.max(0, bookingOnlyExpected - paidForBooking),
        status: b.paymentStatus,
        processedBy,
        receivedBy: { name: '—', portal: '' }
      });

      // Add Booking Inventory
      if (b.products && b.products.length > 0) {
        b.products.forEach((p: any, idx: number) => {
          const itemExpected = p.price * p.quantity;
          const itemPaid = totalPaid >= totalExpected ? itemExpected : (itemExpected / (productAmount || 1)) * paidForProducts;
          
          items.push({
            id: `${b._id}-prod-${idx}`,
            date,
            type: 'Booking Inventory',
            customer: b.customerName || 'N/A',
            details: `${p.name || p.itemId?.name || 'Item'} x${p.quantity}`,
            expected: itemExpected,
            paid: itemPaid,
            pending: Math.max(0, itemExpected - itemPaid),
            status: b.paymentStatus,
            processedBy,
            receivedBy: { name: '—', portal: '' }
          });
        });
      }
    });

    // Process Direct Sales
    data.sales.forEach((s: any) => {
      const date = new Date(s.date);
      const user = s.enteredBy as any;
      items.push({
        id: s._id,
        date,
        type: 'Direct Sale',
        customer: s.customerName || 'Walk-in',
        details: `${s.itemId?.name || 'Item'} x${s.quantity}`,
        expected: s.amount,
        paid: s.amount,
        pending: 0,
        status: 'paid',
        processedBy: {
          name: user?.name || 'Admin',
          position: user?.positionId?.title || user?.userType || 'Super Admin'
        },
        receivedBy: { name: '—', portal: '' }
      });
    });

    // Filter by Date Range
    const now = new Date();
    let filteredItems = items.filter(t => {
      if (exportDateRange === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return t.date >= start;
      } else if (exportDateRange === 'yesterday') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end.setMilliseconds(-1);
        return t.date >= start && t.date <= end;
      } else if (exportDateRange === 'last7') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        return t.date >= start;
      } else if (exportDateRange === 'last30') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        return t.date >= start;
      } else if (exportDateRange === 'custom') {
        if (exportFromDate) {
          const start = new Date(exportFromDate);
          start.setHours(0, 0, 0, 0);
          if (t.date < start) return false;
        }
        if (exportToDate) {
          const end = new Date(exportToDate);
          end.setHours(23, 59, 59, 999);
          if (t.date > end) return false;
        }
      }
      return true;
    });

    // Sort by Date DESC
    filteredItems.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Filter by Type
    if (filterType === 'bookings') {
      filteredItems = filteredItems.filter(i => i.type === 'Booking');
    } else if (filterType === 'sales') {
      filteredItems = filteredItems.filter(i => i.type === 'Direct Sale' || i.type === 'Booking Inventory');
    }

    // Filter by Status
    if (statusFilter && statusFilter !== 'all') {
      filteredItems = filteredItems.filter(i => i.status === statusFilter);
    }

    return filteredItems;
  }, [data, exportDateRange, exportFromDate, exportToDate, filterType, statusFilter]);

  const exportExcel = () => {
    if (!unifiedData.length) return showToast('No data to export', 'error');

    const exportData = unifiedData.map((item: any) => ({
      'Date': item.date.toLocaleDateString('en-IN'),
      'Type': item.type,
      'Customer': item.customer,
      'Details': item.details,
      'Amount': item.paid.toFixed(2),
      'Status': item.status.toUpperCase()
    }));

    exportData.push({
      'Date': 'TOTAL REVENUE',
      'Type': '',
      'Customer': '',
      'Details': '',
      'Amount': unifiedData.reduce((acc: number, item: any) => acc + item.paid, 0).toFixed(2),
      'Status': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Separate Report');
    XLSX.writeFile(workbook, `Separate_Report_${new Date().getTime()}.xlsx`);
  };

  const exportPDF = async () => {
    if (!unifiedData.length) return showToast('No data to export', 'error');

    try {
      const { generateStandardReport } = await import('@/lib/report-generator');

      let logoBase64 = '';
      try {
        const img = new window.Image();
        img.src = '/logo.png';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          logoBase64 = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('Could not load logo for PDF', e);
      }

      const totalAmount = unifiedData.reduce((sum: number, b: any) => sum + (b.paid || 0), 0);
      
      let reportPeriodStr = exportDateRange.toUpperCase();
      if (exportDateRange === 'custom') {
        reportPeriodStr = `${exportFromDate || 'Start'} to ${exportToDate || 'End'}`;
      }

      generateStandardReport({
        title: 'Separate Report',
        reportPeriod: reportPeriodStr,
        summary: [
          { label: 'Filter', value: filterType.toUpperCase() },
          { label: 'Total Items', value: unifiedData.length.toString() },
          { label: 'Total Amount', value: `Rs.${totalAmount.toFixed(2)}` }
        ],
        columns: [
          { header: 'Date', dataKey: 'date', width: 60 },
          { header: 'Type', dataKey: 'type' },
          { header: 'Customer', dataKey: 'customer' },
          { header: 'Summary', dataKey: 'details' },
          { header: 'Processed By', dataKey: 'processedBy' },
          { header: 'Received By', dataKey: 'receivedBy' },
          { header: 'Amount', dataKey: 'amount', align: 'right' }
        ],
        data: unifiedData.map((t: any) => ({
          date: t.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          type: t.type,
          customer: (t.customer || '—').substring(0, 20),
          details: (t.details || '—').substring(0, 30),
          processedBy: t.processedBy?.name || '—',
          receivedBy: t.receivedBy?.name || '—',
          amount: `Rs.${t.paid.toFixed(2)}`
        })),
        filename: `Separate_Report_${new Date().getTime()}.pdf`,
        logoBase64
      });
    } catch (error) {
      console.error('Failed to generate PDF', error);
      showToast('Failed to generate PDF', 'error');
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading separate report data...</div></div>;
  }

  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Separate Report</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Itemized transactions segregating bookings and direct sales</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select 
              className="form-select" 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px', height: '36px', width: '160px' }}
            >
              <option value="bookings">Bookings</option>
              <option value="sales">Sales</option>
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={exportPDF} title="Export PDF"><Download size={14} /> PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={exportExcel} title="Export Excel"><Download size={14} /> Excel</button>
        </div>
      </div>

      <div className="data-table-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <table className="data-table" style={{ fontSize: 'var(--text-sm)' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-primary)', zIndex: 1 }}>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) setSelectedBills(new Set(unifiedData.map((t: any) => t.id)));
                    else setSelectedBills(new Set());
                  }}
                  checked={unifiedData.length > 0 && selectedBills.size === unifiedData.length}
                />
              </th>
              <th>Date</th>
              <th>Type</th>
              <th>Customer / Supplier</th>
              <th>Summary</th>
              <th>Amount</th>
              <th>Processed By</th>
              <th>Received By</th>
            </tr>
          </thead>
          <tbody>
            {unifiedData.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No records found for the selected filter</td></tr>
            ) : unifiedData.map((item: any) => (
              <tr key={item.id} className="hover-row">
                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedBills.has(item.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedBills);
                      if (e.target.checked) newSet.add(item.id);
                      else newSet.delete(item.id);
                      setSelectedBills(newSet);
                    }}
                  />
                </td>
                <td style={{ fontWeight: 500 }}>{item.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td>
                  <span className={`badge ${item.type === 'Direct Sale' ? 'badge-success' : item.type === 'Booking' ? 'badge-info' : 'badge-warning'} badge-dot`} style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                    {item.type}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{item.customer}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{item.details}</td>
                <td style={{ fontWeight: 600, color: 'var(--status-success)' }}>+{fmt(item.paid)}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.processedBy?.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.processedBy?.position}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.receivedBy?.name}</div>
                  {item.receivedBy?.portal && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.receivedBy.portal}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
