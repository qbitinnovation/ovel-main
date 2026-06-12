'use client';

import { useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { SAFETY_CHECKLIST_ITEMS } from '@/lib/constants';

export default function SafetyCheckoutPage() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [confirmCash, setConfirmCash] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const completedCount = useMemo(
    () => SAFETY_CHECKLIST_ITEMS.filter((item) => checkedItems[item.key]).length,
    [checkedItems]
  );
  const allComplete = completedCount === SAFETY_CHECKLIST_ITEMS.length && confirmCash;

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleItem = (key: string) => {
    setCheckedItems((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleCheckout = () => {
    if (!allComplete) {
      showToast('Complete every safety item before checkout', 'error');
      return;
    }
    showToast('Safety checkout completed');
    setTimeout(() => signOut({ callbackUrl: '/login' }), 600);
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? 'x' : '✓'}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}

      <div className="page-header">
        <div>
          <h1>Safety Checkout</h1>
          <p className="page-subtitle">Complete the end-of-day safety checks before logging out</p>
        </div>
        <span className={`badge ${allComplete ? 'badge-success' : 'badge-warning'} badge-dot`}>
          {completedCount}/{SAFETY_CHECKLIST_ITEMS.length} checked
        </span>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header"><h3 style={{ fontSize: 'var(--text-sm)' }}>Closing Checklist</h3></div>
        <div style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
          {SAFETY_CHECKLIST_ITEMS.map((item, index) => (
            <button
              key={item.key}
              className="card"
              type="button"
              onClick={() => toggleItem(item.key)}
              style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 'var(--space-4)', alignItems: 'center', textAlign: 'left', cursor: 'pointer', border: checkedItems[item.key] ? '1px solid var(--status-success)' : '1px solid var(--surface-glass-border)' }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-full)', background: checkedItems[item.key] ? 'var(--status-success)' : 'var(--bg-tertiary)', color: checkedItems[item.key] ? 'white' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {checkedItems[item.key] ? '✓' : index + 1}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>{item.labelMl}</div>
              </div>
              <input type="checkbox" checked={!!checkedItems[item.key]} readOnly aria-label={item.label} />
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={confirmCash} onChange={(e) => setConfirmCash(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <span style={{ display: 'block', fontWeight: 700 }}>I confirm the closing responsibility is complete.</span>
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
              Gates, lights, cash handover, and staff verification are complete for the day.
            </span>
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-lg" onClick={handleCheckout} disabled={!allComplete}>
          Confirm Checkout & Logout
        </button>
      </div>
    </div>
  );
}
