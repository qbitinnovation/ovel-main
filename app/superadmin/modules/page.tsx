'use client';

import { useState, useEffect, useCallback } from 'react';

interface Position {
  _id: string;
  name: string;
  isActive: boolean;
}

interface Mapping {
  _id: string;
  positionId: string | { _id: string; name: string; isActive: boolean };
  moduleKey: string;
  accessLevel: string;
  enabledActions: string[];
  isActive: boolean;
}

interface ModuleDef {
  moduleKey: string;
  moduleName: string;
  description: string;
  icon: string;
  displayOrder: number;
  availableActions: string[];
}

const ACCESS_LEVELS = [
  { value: 'view', label: 'View Only', description: 'Can see data but cannot make changes' },
  { value: 'edit', label: 'Edit Access', description: 'Can view and modify data within permitted actions' },
  { value: 'full_control', label: 'Full Control', description: 'Complete access to all actions in this module' },
];

const ACTION_LABELS: Record<string, string> = {
  create_user: 'Create User', archive_user: 'Archive User', edit_user: 'Edit User',
  map_module_to_position: 'Map Module to Committee Position',
  remove_module_from_position: 'Remove Module from Position',
  add_individual_override: 'Add Individual Override', remove_override: 'Remove Override',
  submit_daily_entry: 'Submit Daily Finance Entry', view_finance_history: 'View Finance History',
  export_finance_report: 'Export Finance Reports', request_unlock: 'Request Admin Unlock',
  log_sale: 'Log Sale', add_restock_entry: 'Add Restock', view_inventory_levels: 'View Inventory Levels',
  set_low_stock_threshold: 'Set Low Stock Threshold', export_inventory_report: 'Export Inventory Report',
  create_task: 'Create Task', edit_task: 'Edit Task', assign_task: 'Assign Task',
  update_task_status: 'Update Task Status', close_task: 'Close Task', reopen_task: 'Reopen Task',
  delete_task: 'Delete Task', view_all_tasks: 'View All Tasks',
  view_checklist: 'View Checklist', submit_checklist_item: 'Submit Checklist Item',
  resubmit_rejected_item: 'Resubmit Rejected Item', approve_checklist_item: 'Approve Checklist Item',
  reject_checklist_item: 'Reject Checklist Item',
  configure_notification_rules: 'Configure Notification Rules', manage_channels: 'Manage Channels',
  view_notification_log: 'View Notification Log',
  view_dashboards: 'View Dashboards', export_report: 'Export Report',
  schedule_report_delivery: 'Schedule Report Delivery',
  create_mom_entry: 'Create MOM Entry', convert_to_malayalam: 'Convert to Malayalam',
  edit_translation: 'Edit Translation', save_mom_record: 'Save MOM Record',
  attach_malayalam_instruction: 'Attach Malayalam Instruction', view_mom_history: 'View MOM History',
  complete_safety_checklist: 'Complete Safety Checklist', confirm_logout: 'Confirm Logout',
  view_audit_logs: 'View Audit Logs', search_filter_logs: 'Search & Filter Logs',
  export_audit_report: 'Export Audit Report',
};

// Module definitions (matching constants.ts)
const MODULE_DEFS: ModuleDef[] = [
  { moduleKey: 'accounts_finance', moduleName: 'Accounts & Finance', description: 'Daily financial recording', icon: '💰', displayOrder: 2, availableActions: ['submit_daily_entry', 'view_finance_history', 'export_finance_report', 'request_unlock'] },
  { moduleKey: 'inventory_sales', moduleName: 'Inventory & Sales', description: 'Consumables tracking and sales', icon: '📦', displayOrder: 3, availableActions: ['log_sale', 'add_restock_entry', 'view_inventory_levels', 'set_low_stock_threshold', 'export_inventory_report'] },
  { moduleKey: 'maintenance_tasks', moduleName: 'Maintenance & Tasks', description: 'Physical maintenance tracking', icon: '🔧', displayOrder: 4, availableActions: ['create_task', 'edit_task', 'assign_task', 'update_task_status', 'close_task', 'reopen_task', 'delete_task', 'view_all_tasks'] },
  { moduleKey: 'daily_operations', moduleName: 'Checklists', description: 'Daily staff checklist with photo proof', icon: '✅', displayOrder: 5, availableActions: ['view_checklist', 'submit_checklist_item', 'resubmit_rejected_item', 'approve_checklist_item', 'reject_checklist_item'] },
  { moduleKey: 'notifications', moduleName: 'Notifications', description: 'Real-time alerts configuration', icon: '🔔', displayOrder: 6, availableActions: ['configure_notification_rules', 'manage_channels', 'view_notification_log'] },
  { moduleKey: 'reports_analytics', moduleName: 'Reports & Analytics', description: 'Dashboards and exportable reports', icon: '📊', displayOrder: 7, availableActions: ['view_dashboards', 'export_report', 'schedule_report_delivery'] },
  { moduleKey: 'malayalam_mom', moduleName: 'MOM & Malayalam', description: 'Minutes of Meeting with translation', icon: '📝', displayOrder: 8, availableActions: ['create_mom_entry', 'convert_to_malayalam', 'edit_translation', 'save_mom_record', 'attach_malayalam_instruction', 'view_mom_history'] },
  { moduleKey: 'safety_checklist', moduleName: 'Safety Checklist', description: 'End-of-day safety verification', icon: '🛡️', displayOrder: 9, availableActions: ['complete_safety_checklist', 'confirm_logout'] },
  { moduleKey: 'audit_log', moduleName: 'Audit Log', description: 'Tamper-proof activity records', icon: '📋', displayOrder: 10, availableActions: ['view_audit_logs', 'search_filter_logs', 'export_audit_report'] },
];

export default function ModuleMappingPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Config panel state
  const [configModule, setConfigModule] = useState<ModuleDef | null>(null);
  const [configAccessLevel, setConfigAccessLevel] = useState('view');
  const [configActions, setConfigActions] = useState<string[]>([]);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteMapping, setDeleteMapping] = useState<Mapping | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/positions');
      const data = await res.json();
      if (data.success) {
        setPositions(data.data.filter((p: Position) => p.isActive));
      }
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    }
  }, []);

  const fetchMappings = useCallback(async (posId?: string) => {
    try {
      const url = posId ? `/api/module-mappings?positionId=${posId}` : '/api/module-mappings';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMappings(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPositions(), fetchMappings()]).finally(() => setLoading(false));
  }, [fetchPositions, fetchMappings]);

  useEffect(() => {
    if (selectedPosition) fetchMappings(selectedPosition);
  }, [selectedPosition, fetchMappings]);

  const getMappingForModule = (moduleKey: string): Mapping | undefined => {
    return mappings.find(
      (m) =>
        m.moduleKey === moduleKey &&
        (typeof m.positionId === 'string'
          ? m.positionId === selectedPosition
          : m.positionId._id === selectedPosition)
    );
  };

  const openConfig = (mod: ModuleDef, existingMapping?: Mapping) => {
    setConfigModule(mod);
    if (existingMapping) {
      setConfigAccessLevel(existingMapping.accessLevel);
      setConfigActions([...existingMapping.enabledActions]);
      setEditingMappingId(existingMapping._id);
    } else {
      setConfigAccessLevel('view');
      setConfigActions([]);
      setEditingMappingId(null);
    }
  };

  const toggleAction = (action: string) => {
    setConfigActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const handleSaveMapping = async () => {
    if (!selectedPosition || !configModule) return;
    setSaving(true);

    try {
      if (editingMappingId) {
        // Update existing
        const res = await fetch(`/api/module-mappings/${editingMappingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessLevel: configAccessLevel, enabledActions: configActions }),
        });
        const data = await res.json();
        if (data.success) {
          showToast('Mapping updated');
        } else {
          showToast(data.message || 'Failed to update', 'error');
        }
      } else {
        // Create new
        const res = await fetch('/api/module-mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positionId: selectedPosition,
            moduleKey: configModule.moduleKey,
            accessLevel: configAccessLevel,
            enabledActions: configActions,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast('Module mapped successfully');
        } else {
          showToast(data.message || 'Failed to map', 'error');
        }
      }
      setConfigModule(null);
      fetchMappings(selectedPosition);
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async () => {
    if (!deleteMapping) return;
    try {
      const res = await fetch(`/api/module-mappings/${deleteMapping._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Mapping removed');
        fetchMappings(selectedPosition || undefined);
      } else {
        showToast(data.message || 'Failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
    setDeleteMapping(null);
  };

  const accessLevelLabel = (level: string) => {
    return ACCESS_LEVELS.find((a) => a.value === level)?.label || level;
  };

  const selectedPosName = positions.find((p) => p._id === selectedPosition)?.name || '';

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-screen">
          <div className="spinner spinner-lg" />
          <div className="loading-text">Loading module mapping...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Module Mapping</h1>
          <p className="page-subtitle">Connect modules to positions with custom access levels and actions</p>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            <div className="empty-state-title">No committee positions yet</div>
            <div className="empty-state-description">
              Create a committee member and type their position manually before mapping modules.
            </div>
            <a href="/superadmin/users" className="btn btn-primary btn-md" style={{ marginTop: 'var(--space-4)', textDecoration: 'none' }}>
              Create Committee Member
            </a>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-6)', minHeight: '60vh' }}>
          {/* Left Panel — Committee Positions List */}
          <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 'calc(var(--topbar-height) + var(--space-6))' }}>
            <div className="card-header">
              <h3 style={{ fontSize: 'var(--text-sm)' }}>Committee Positions</h3>
              <span className="badge badge-neutral">{positions.length}</span>
            </div>
            <div style={{ padding: 'var(--space-2)' }}>
              {positions.map((pos) => (
                <button
                  key={pos._id}
                  className={`sidebar-link ${selectedPosition === pos._id ? 'active' : ''}`}
                  onClick={() => setSelectedPosition(pos._id)}
                  style={{ width: '100%', border: 'none', cursor: 'pointer', background: selectedPosition === pos._id ? 'var(--accent-primary-soft)' : 'transparent', textAlign: 'left' }}
                >
                  <span className="sidebar-link-icon">🏷️</span>
                  <span>{pos.name}</span>
                  {selectedPosition === pos._id && (
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--accent-primary)' }}>
                      {mappings.length} mapped
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel — Modules */}
          <div>
            {!selectedPosition ? (
              <div className="card">
                <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                  <div className="empty-state-icon">👈</div>
                  <div className="empty-state-title">Select a position</div>
                  <div className="empty-state-description">
                    Choose a position from the left panel to view and manage its module mappings.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  <h2 style={{ fontSize: 'var(--text-lg)' }}>{selectedPosName}</h2>
                  <span className="badge badge-success badge-dot">Active</span>
                </div>

                {MODULE_DEFS.map((mod) => {
                  const mapping = getMappingForModule(mod.moduleKey);
                  const isMapped = !!mapping;

                  return (
                    <div key={mod.moduleKey} className="card" style={{ transition: 'all var(--transition-base)' }}>
                      <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: 1 }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-lg)', background: isMapped ? 'var(--accent-primary-soft)' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xl)', flexShrink: 0 }}>
                            {mod.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              {mod.moduleName}
                              {isMapped && (
                                <span className="badge badge-success badge-dot" style={{ fontSize: '11px' }}>
                                  {accessLevelLabel(mapping.accessLevel)}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {mod.description}
                            </div>
                            {isMapped && mapping.enabledActions.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                                {mapping.enabledActions.map((a) => (
                                  <span key={a} className="badge badge-neutral" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                    {ACTION_LABELS[a] || a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {isMapped ? (
                            <>
                              <button className="btn btn-ghost btn-sm" onClick={() => openConfig(mod, mapping)}>
                                ✏️ Edit
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={() => setDeleteMapping(mapping)}>
                                ✕
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => openConfig(mod)}>
                              + Map This Module
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {configModule && (
        <div className="modal-backdrop" onClick={() => setConfigModule(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {configModule.icon} Configure {configModule.moduleName}
                {selectedPosName && (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 'var(--space-2)' }}>
                    for {selectedPosName}
                  </span>
                )}
              </h3>
              <button className="modal-close" onClick={() => setConfigModule(null)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Access Level */}
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label" style={{ marginBottom: 'var(--space-3)', display: 'block' }}>Access Level</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {ACCESS_LEVELS.map((level) => (
                    <label key={level.value} className="card card-interactive" style={{
                      padding: 'var(--space-4)',
                      cursor: 'pointer',
                      borderColor: configAccessLevel === level.value ? 'var(--accent-primary)' : undefined,
                      background: configAccessLevel === level.value ? 'var(--accent-primary-soft)' : undefined,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <input
                          type="radio"
                          name="accessLevel"
                          value={level.value}
                          checked={configAccessLevel === level.value}
                          onChange={() => setConfigAccessLevel(level.value)}
                          style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{level.label}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{level.description}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Toggles */}
              <div>
                <label className="form-label" style={{ marginBottom: 'var(--space-3)', display: 'block' }}>
                  Available Actions
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'var(--space-2)' }}>
                    ({configActions.length} of {configModule.availableActions.length} enabled)
                  </span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {configModule.availableActions.map((action) => {
                    const isOn = configActions.includes(action);
                    return (
                      <div
                        key={action}
                        className="toggle-wrapper"
                        onClick={() => toggleAction(action)}
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          background: isOn ? 'hsla(160, 84%, 39%, 0.05)' : 'transparent',
                          transition: 'background var(--transition-fast)',
                        }}
                      >
                        <div className={`toggle ${isOn ? 'active' : ''}`} />
                        <span className="toggle-label" style={{ color: isOn ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {ACTION_LABELS[action] || action}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setConfigModule(null)}>Cancel</button>
              <button
                className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`}
                onClick={handleSaveMapping}
                disabled={saving}
              >
                {editingMappingId ? 'Save Changes' : 'Save Mapping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteMapping && (
        <div className="modal-backdrop" onClick={() => setDeleteMapping(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-body" style={{ paddingTop: 'var(--space-8)' }}>
              <div className="confirm-icon danger">✕</div>
              <div className="confirm-title">Remove Module Mapping?</div>
              <div className="confirm-message">
                All users holding the <strong>{selectedPosName}</strong> position will lose access to this module immediately.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setDeleteMapping(null)}>Cancel</button>
              <button className="btn btn-danger btn-md" onClick={handleDeleteMapping}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
