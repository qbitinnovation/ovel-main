'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACTION_LABELS, MODULE_DEFINITIONS } from '@/lib/constants';

type ModuleAccess = {
  moduleKey: string;
  accessLevel: string;
  enabledActions: string[];
};

type Props = {
  moduleKey: string;
  requiredAction?: string;
  children: React.ReactNode;
};

const HARMLESS_BUTTONS = [
  'back',
  'cancel',
  'close',
  'done',
  'view',
  'all',
  'today',
  'week',
  'month',
  'custom',
  'history',
  'details',
  'copy',
  'capture',
  'open camera',
  'retake',
  'filter',
];

const HARMLESS_EXACT_BUTTONS = ['+', '-', 'x', '×'];

const ACTION_MATCHERS: Record<string, string[]> = {
  submit_daily_entry: ['new entry', 'submit', 'submit & lock', 'add row'],
  request_unlock: ['request unlock'],
  add_item: ['add turf item', 'add item'],
  edit_item: ['edit', 'update', 'save changes', 'edit item', 'update item'],
  delete_item: ['delete item', 'remove item', 'delete'],
  export_turf_inventory_report: ['export pdf', 'export excel'],
  export_sales_report: ['export pdf', 'export excel'],
  create_sale: ['log sale', 'sell'],
  add_restock: ['add restock', 'restock'],
  set_low_stock_threshold: ['threshold'],
  create_task: ['create task'],
  edit_task: ['edit', 'save changes'],
  assign_task: ['assign'],
  update_task_status: ['start', 'complete'],
  close_task: ['close'],
  reopen_task: ['reopen'],
  delete_task: ['delete'],
  upload_checklist: ['submit item', 'retake', 'open camera'],
  verify_checklist: ['verify'],
  approve_checklist: ['approve'],
  reject_checklist: ['reject'],
  // Smart Attendance
  submit_attendance: ['mark attendance', 'submit attendance', 'check in'],
  verify_attendance: ['verify attendance', 'approve attendance', 'reject attendance'],
  view_attendance_reports: ['view attendance history', 'view attendance'],
  create_mom_entry: ['new mom', 'save mom'],
  convert_to_malayalam: ['convert to malayalam'],
  edit_mom: ['edit mom'],
  add_transaction: ['new manual entry', 'submit entry'],
  export_reports: ['export pdf', 'export excel'],
  export_mom_history: ['download pdf', 'download'],
  create_booking: ['new booking', 'create booking'],
  edit_booking: ['edit', 'save changes'],
  cancel_booking: ['cancel booking'],
  add_payment: ['add payment'],
  edit_payment: ['edit payment'],
};

export default function PermissionScopedAdminPage({ moduleKey, children }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [access, setAccess] = useState<ModuleAccess | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');

  const moduleDef = useMemo(
    () => MODULE_DEFINITIONS.find((item) => item.moduleKey === moduleKey),
    [moduleKey]
  );

  const fetchAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me/access', { cache: 'no-store' });
      const data = await res.json();
      const nextAccess = (data.data || []).find((item: ModuleAccess) => item.moduleKey === moduleKey) || null;
      setAccess(nextAccess);
    } catch {
      setAccess(null);
    } finally {
      setLoaded(true);
    }
  }, [moduleKey]);

  useEffect(() => { fetchAccess(); }, [fetchAccess]);

  const canUseAction = useCallback((action: string) => {
    if (!access) return false;
    if (access.accessLevel === 'full_control') return true;
    if (!['edit', 'full_control'].includes(access.accessLevel)) return false;
    return access.enabledActions.includes(action);
  }, [access]);

  const canShowAction = useCallback((action: string | null) => {
    if (!action) return true;
    if (access?.accessLevel === 'full_control') return true;
    if (action === '__unknown_write__') return false;
    return canUseAction(action);
  }, [access?.accessLevel, canUseAction]);

  const classifyButton = useCallback((button: HTMLButtonElement | HTMLAnchorElement) => {
    const text = normalize(button.textContent || button.getAttribute('aria-label') || button.getAttribute('title') || '');
    if (!text) return null;

    for (const action of moduleDef?.availableActions || []) {
      const labels = [ACTION_LABELS[action], ...(ACTION_MATCHERS[action] || [])]
        .filter(Boolean)
        .map((label) => normalize(label));
      if (labels.some((label) => text.includes(label))) return action;
    }

    if (HARMLESS_EXACT_BUTTONS.includes(text)) return null;
    if (HARMLESS_BUTTONS.some((label) => text === label || text.startsWith(`${label} `))) return null;

    if (/(\+|add|create|new|edit|save|submit|delete|remove|archive|approve|reject|complete|close|reopen|reset|log|sell|restock|convert|mark all)/.test(text)) {
      return '__unknown_write__';
    }

    return null;
  }, [moduleDef?.availableActions]);

  const applyPermissions = useCallback(() => {
    const root = rootRef.current;
    if (!root || !loaded) return;

    root.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button, a.btn').forEach((button) => {
      const action = classifyButton(button);
      const visible = canShowAction(action);
      button.toggleAttribute('aria-hidden', !visible);
      button.classList.toggle('permission-hidden', !visible);
      if (!visible) button.title = 'Not enabled for your assigned access level';
      if (visible && button.title === 'Not enabled for your assigned access level') button.removeAttribute('title');
    });
  }, [canShowAction, classifyButton, loaded]);

  useEffect(() => {
    applyPermissions();
    const root = rootRef.current;
    if (!root) return;
    const observer = new MutationObserver(applyPermissions);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [applyPermissions]);

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!loaded) return;
    const target = event.target as HTMLElement;
    const button = target.closest('button, a.btn') as HTMLButtonElement | HTMLAnchorElement | null;
    if (!button) return;

    const action = classifyButton(button);
    if (!canShowAction(action)) {
      event.preventDefault();
      event.stopPropagation();
      setNotice('This action is not enabled for your assigned access level.');
      setTimeout(() => setNotice(''), 3000);
    }
  };

  const [breachLogged, setBreachLogged] = useState(false);

  useEffect(() => {
    if (loaded && !access && !breachLogged) {
      setBreachLogged(true);
      fetch('/api/security/breach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleKey, path: window.location.pathname }),
      }).catch(console.error);
    }
  }, [loaded, access, breachLogged, moduleKey]);

  const label = access?.accessLevel === 'full_control'
    ? 'Full Control'
    : access?.accessLevel === 'edit'
      ? 'Edit Access'
      : access?.accessLevel === 'view'
        ? 'View Only'
        : 'No Access';

  if (loaded && !access) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-bold">!</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          You do not have permission to view the {moduleDef?.moduleName || 'requested'} module. 
          This unauthorized access attempt has been logged.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} onClickCapture={handleClickCapture}>
      <style>{`.permission-hidden { display: none !important; }`}</style>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 var(--space-6) var(--space-3)' }}>
        <span className={`badge ${access?.accessLevel === 'full_control' ? 'badge-success' : access?.accessLevel === 'edit' ? 'badge-warning' : access?.accessLevel === 'view' ? 'badge-info' : 'badge-danger'} badge-dot`}>
          {label}
        </span>
      </div>
      {notice && <div className="toast-container"><div className="toast toast-error"><span className="toast-icon">x</span><div className="toast-content"><div className="toast-title">{notice}</div></div></div></div>}
      {children}
    </div>
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
