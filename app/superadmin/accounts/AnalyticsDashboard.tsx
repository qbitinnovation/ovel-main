import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, DollarSign, Clock, PieChart, CalendarCheck, Package, CreditCard, Activity, Calendar } from 'lucide-react';

export default function AnalyticsDashboard({ 
  showToast,
  fmt
}: { 
  showToast: (m: string, t?: string) => void;
  fmt: (n: number) => string;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ bookings: [], sales: [] });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/accounts/billing?limit=5000'); // large limit for analytics
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

  const analytics = useMemo(() => {
    let totalCollected = 0;
    let totalPending = 0;
    let totalExpected = 0;
    
    let todayCollected = 0;
    let monthCollected = 0;

    let coreBookingRev = 0;
    let inventoryRev = 0; // both direct sales and booking products
    let totalBookingsCount = data.bookings.length;
    let totalSalesCount = data.sales.length;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    data.bookings.forEach((b: any) => {
      const date = new Date(b.bookingDate || b.createdAt).getTime();
      const expected = b.expectedAmount || 0;
      const paid = b.totalPaid || 0;
      const pending = Math.max(0, expected - paid);
      const productAmt = b.productAmount || 0;

      totalCollected += paid;
      totalPending += pending;
      totalExpected += expected;

      // To simplify, if paid, we just attribute proportionately or use expected
      // Actually, let's track the total EXPECTED for these categories for a pure breakdown
      coreBookingRev += Math.max(0, expected - productAmt);
      inventoryRev += productAmt;

      if (date >= startOfToday) todayCollected += paid;
      if (date >= startOfMonth) monthCollected += paid;
    });

    data.sales.forEach((s: any) => {
      const date = new Date(s.date).getTime();
      const paid = s.amount || 0;
      
      totalCollected += paid;
      totalExpected += paid;
      inventoryRev += paid;

      if (date >= startOfToday) todayCollected += paid;
      if (date >= startOfMonth) monthCollected += paid;
    });

    const collectedPercent = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
    const pendingPercent = totalExpected > 0 ? (totalPending / totalExpected) * 100 : 0;

    const corePercent = totalExpected > 0 ? (coreBookingRev / totalExpected) * 100 : 0;
    const invPercent = totalExpected > 0 ? (inventoryRev / totalExpected) * 100 : 0;

    return { 
      totalCollected, totalPending, totalExpected, 
      collectedPercent, pendingPercent,
      todayCollected, monthCollected,
      coreBookingRev, inventoryRev, corePercent, invPercent,
      totalBookingsCount, totalSalesCount
    };
  }, [data]);

  if (loading) {
    return <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading analytics...</div></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      
      {/* Top Highlight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.02) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today's Collection</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--status-success)', marginTop: '4px' }}>{fmt(analytics.todayCollected)}</div>
            </div>
            <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Activity size={20} color="var(--status-success)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)', opacity: 0.8 }}>Live tracking of today's payments</div>
        </div>

        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.02) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Month</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{fmt(analytics.monthCollected)}</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Calendar size={20} color="var(--status-info)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-info)', opacity: 0.8 }}>Total collected this month</div>
        </div>

        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(234, 179, 8, 0.02) 100%)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Pending</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--status-warning)', marginTop: '4px' }}>{fmt(analytics.totalPending)}</div>
            </div>
            <div style={{ background: 'rgba(234, 179, 8, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Clock size={20} color="var(--status-warning)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-warning)', opacity: 0.8 }}>Payments yet to be collected</div>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Main Collection Progress */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-6)' }}>
            <PieChart size={20} /> Collection Health
          </h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Total Expected Revenue</div>
              <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 800, marginTop: '4px' }}>{fmt(analytics.totalExpected)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Overall Collected</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--status-success)', marginTop: '4px' }}>{fmt(analytics.totalCollected)}</div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              <span style={{ color: 'var(--status-success)' }}>Collected ({analytics.collectedPercent.toFixed(1)}%)</span>
              <span style={{ color: 'var(--status-warning)' }}>Pending ({analytics.pendingPercent.toFixed(1)}%)</span>
            </div>
            <div style={{ width: '100%', height: '24px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${analytics.collectedPercent}%`, background: 'var(--status-success)', transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
              <div style={{ width: `${analytics.pendingPercent}%`, background: 'var(--status-warning)', transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </div>
          </div>
        </div>

        {/* Revenue Sources Breakdown */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-6)' }}>
            <CreditCard size={20} /> Revenue Sources
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--status-info)', padding: '6px', borderRadius: '8px', color: 'white' }}><CalendarCheck size={16} /></div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Core Bookings</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{analytics.corePercent.toFixed(1)}% of total</div>
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>{fmt(analytics.coreBookingRev)}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--status-success)', padding: '6px', borderRadius: '8px', color: 'white' }}><Package size={16} /></div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Inventory / Retail</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{analytics.invPercent.toFixed(1)}% of total</div>
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>{fmt(analytics.inventoryRev)}</div>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--surface-glass-border)', paddingTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{analytics.totalBookingsCount}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '2px' }}>Total Bookings</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{analytics.totalSalesCount}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '2px' }}>Direct Sales</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
