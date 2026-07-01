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
  const [data, setData] = useState({ bookings: [], sales: [], expenses: [] });

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

    let totalExpenses = 0;
    let todayExpenses = 0;
    let monthExpenses = 0;

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

    (data.expenses || []).forEach((e: any) => {
      const date = new Date(e.date || e.createdAt).getTime();
      const amt = e.amount || 0;

      totalExpenses += amt;
      if (date >= startOfToday) todayExpenses += amt;
      if (date >= startOfMonth) monthExpenses += amt;
    });

    const collectedPercent = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
    const pendingPercent = totalExpected > 0 ? (totalPending / totalExpected) * 100 : 0;

    const corePercent = totalExpected > 0 ? (coreBookingRev / totalExpected) * 100 : 0;
    const invPercent = totalExpected > 0 ? (inventoryRev / totalExpected) * 100 : 0;

    return { 
      totalCollected, totalPending, totalExpected, 
      collectedPercent, pendingPercent,
      todayCollected, monthCollected,
      totalExpenses, todayExpenses, monthExpenses,
      coreBookingRev, inventoryRev, corePercent, invPercent,
      totalBookingsCount, totalSalesCount
    };
  }, [data]);

  if (loading) {
    return <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading analytics...</div></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      
      {/* 2 Top Cards Grid (Matches main dashboard) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        
        {/* Card 1: Collection Metrics */}
        <div className="card" style={{ borderRadius: '24px', padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Collection Metrics</div>
            <DollarSign size={18} color="var(--text-secondary)" />
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--status-success)', lineHeight: '1' }}>{fmt(analytics.todayCollected)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Today</div>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1' }}>{fmt(analytics.monthCollected)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>This Month</div>
            </div>
          </div>
          
          <div style={{ marginTop: 'auto', position: 'relative', height: '40px', width: '100%' }}>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%', stroke: 'var(--status-success)', strokeWidth: 2, fill: 'none', opacity: 0.5 }}>
              <path d="M0 35 Q 10 30, 20 35 T 40 25 T 60 10 T 80 15 T 100 20" />
            </svg>
          </div>
        </div>

        {/* Card 2: Expenses */}
        <div className="card" style={{ borderRadius: '24px', padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Expenses</div>
            <Clock size={18} color="var(--text-secondary)" />
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--status-danger)', lineHeight: '1' }}>{fmt(analytics.totalExpenses)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Expenses</div>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--status-warning)', lineHeight: '1' }}>{fmt(analytics.totalPending)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Pending</div>
            </div>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '40px' }}>
              <div style={{ width: '20px', height: '60%', background: '#f0f0f0', borderRadius: '4px' }}></div>
              <div style={{ width: '20px', height: '40%', background: '#f0f0f0', borderRadius: '4px' }}></div>
              <div style={{ width: '20px', height: '100%', background: '#f0f0f0', borderRadius: '4px' }}></div>
              <div style={{ width: '20px', height: '80%', background: '#f0f0f0', borderRadius: '4px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Full Width (Matches "Pending Tasks" main dashboard) */}
      <div className="card" style={{ borderRadius: '24px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', border: 'none', position: 'relative', overflow: 'hidden' }}>
        <div style={{ zIndex: 1, maxWidth: '60%', width: '100%' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Collection Health</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>Total Expected: {fmt(analytics.totalExpected)}</div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              <span style={{ color: 'var(--status-success)' }}>Collected ({analytics.collectedPercent.toFixed(1)}%)</span>
              <span style={{ color: 'var(--status-warning)' }}>Pending ({analytics.pendingPercent.toFixed(1)}%)</span>
            </div>
            <div style={{ width: '100%', height: '16px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${analytics.collectedPercent}%`, background: 'var(--status-success)', transition: 'width 1.5s' }} />
              <div style={{ width: `${analytics.pendingPercent}%`, background: 'var(--status-warning)', transition: 'width 1.5s' }} />
            </div>
          </div>
        </div>
        
        {/* Decorative circle graphic for the right side */}
        <div style={{ 
          position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)',
          width: '120px', height: '120px', borderRadius: '50%', 
          border: '1px solid #eaeaea', 
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', 
            background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <PieChart size={20} color="var(--text-secondary)" style={{ marginBottom: '4px' }}/>
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1' }}>Health</span>
          </div>
        </div>
      </div>

      {/* Other Modules List (Matches "System Modules" main dashboard) */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>Revenue Sources</h3>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Breakdown by operational stream</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="card" style={{ padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' }}><CalendarCheck size={16} color="var(--status-info)" /></div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Core Bookings ({analytics.totalBookingsCount})</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{analytics.corePercent.toFixed(1)}% of total</div>
              </div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(analytics.coreBookingRev)}</div>
          </div>
          
          <div className="card" style={{ padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' }}><Package size={16} color="var(--status-success)" /></div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Inventory & Sales ({analytics.totalSalesCount})</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{analytics.invPercent.toFixed(1)}% of total</div>
              </div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(analytics.inventoryRev)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
