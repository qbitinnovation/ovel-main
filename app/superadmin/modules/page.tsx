'use client';

import { useState, useEffect, useCallback } from 'react';
import { ACTION_LABELS, MODULE_DEFINITIONS } from '@/lib/constants';

interface Position {
  _id: string;
  name: string;
  isActive: boolean;
}

interface Mapping {
  _id: string;
  positionId?: string | { _id: string; name: string; isActive: boolean };
  portalType?: string;
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

const MODULE_DEFS: ModuleDef[] = MODULE_DEFINITIONS
  .filter((mod) => !['user_permission', 'audit_log', 'safety_checklist'].includes(mod.moduleKey))
  .sort((a, b) => a.displayOrder - b.displayOrder);

export default function ModuleMappingPage() {
  const [activeTab, setActiveTab] = useState<'committee' | 'portal'>('committee');

  // Committee State
  const [positions, setPositions] = useState<Position[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  // Portal State
  const [portalMappings, setPortalMappings] = useState<Mapping[]>([]);
  const [selectedPortal, setSelectedPortal] = useState<string | null>(null);

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

  const fetchPortalMappings = useCallback(async (portal?: string) => {
    try {
      const url = portal ? `/api/portal-mappings?portalType=${portal}` : '/api/portal-mappings';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPortalMappings(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch portal mappings:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPositions(), fetchMappings(), fetchPortalMappings()]).finally(() => setLoading(false));
  }, [fetchPositions, fetchMappings, fetchPortalMappings]);

  useEffect(() => {
    if (selectedPosition && activeTab === 'committee') fetchMappings(selectedPosition);
  }, [selectedPosition, activeTab, fetchMappings]);

  useEffect(() => {
    if (selectedPortal && activeTab === 'portal') fetchPortalMappings(selectedPortal);
  }, [selectedPortal, activeTab, fetchPortalMappings]);

  const getMappingForModule = (moduleKey: string): Mapping | undefined => {
    if (activeTab === 'committee') {
      return mappings.find(
        (m) =>
          m.moduleKey === moduleKey &&
          (typeof m.positionId === 'string'
            ? m.positionId === selectedPosition
            : m.positionId?._id === selectedPosition)
      );
    } else {
      return portalMappings.find(
        (m) =>
          m.moduleKey === moduleKey &&
          m.portalType === selectedPortal
      );
    }
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

  const handleAccessLevelChange = (level: string) => {
    setConfigAccessLevel(level);
    if (level === 'full_control' && configModule) {
      setConfigActions([...configModule.availableActions]);
    }
  };

  const handleSaveMapping = async () => {
    const isCommittee = activeTab === 'committee';
    const targetId = isCommittee ? selectedPosition : selectedPortal;

    if (!targetId || !configModule) return;
    setSaving(true);
    const actionsToSave = configAccessLevel === 'full_control' ? configModule.availableActions : configActions;

    try {
      const baseUrl = isCommittee ? '/api/module-mappings' : '/api/portal-mappings';
      const payload = isCommittee
        ? { positionId: targetId, moduleKey: configModule.moduleKey, accessLevel: configAccessLevel, enabledActions: actionsToSave }
        : { portalType: targetId, moduleKey: configModule.moduleKey, accessLevel: configAccessLevel, enabledActions: actionsToSave };

      if (editingMappingId) {
        // Update existing
        const res = await fetch(`${baseUrl}/${editingMappingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessLevel: configAccessLevel, enabledActions: actionsToSave }),
        });
        const data = await res.json();
        if (data.success) {
          showToast('Mapping updated');
        } else {
          showToast(data.message || 'Failed to update', 'error');
        }
      } else {
        // Create new
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showToast('Module mapped successfully');
        } else {
          showToast(data.message || 'Failed to map', 'error');
        }
      }
      setConfigModule(null);
      if (isCommittee) fetchMappings(targetId);
      else fetchPortalMappings(targetId);
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async () => {
    if (!deleteMapping) return;
    const isCommittee = activeTab === 'committee';
    const baseUrl = isCommittee ? '/api/module-mappings' : '/api/portal-mappings';
    try {
      const res = await fetch(`${baseUrl}/${deleteMapping._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Mapping removed');
        if (isCommittee) fetchMappings(selectedPosition || undefined);
        else fetchPortalMappings(selectedPortal || undefined);
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

  const selectedPosName = activeTab === 'committee'
    ? positions.find((p) => p._id === selectedPosition)?.name || ''
    : selectedPortal === 'turf' ? 'Turf Manager Portal' : selectedPortal === 'shareholder' ? 'Shareholder Portal' : '';

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
          <p className="page-subtitle">Connect modules to positions or entire portals with custom access levels</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-2)' }}>
        <button
          className={`btn ${activeTab === 'committee' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setActiveTab('committee')}
        >
          Committee Positions
        </button>
        <button
          className={`btn ${activeTab === 'portal' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setActiveTab('portal')}
        >
          Portal Mapping
        </button>
      </div>

      {activeTab === 'committee' && positions.length === 0 ? (
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
        <div className="mapping-layout">
          {/* Left Panel — Sidebar */}
          <div className="card mapping-sidebar" style={{ alignSelf: 'start', position: 'sticky', top: 'calc(var(--topbar-height) + var(--space-6))' }}>
            <div className="card-header">
              <h3 style={{ fontSize: 'var(--text-sm)' }}>
                {activeTab === 'committee' ? 'Committee Positions' : 'Portals'}
              </h3>
              {activeTab === 'committee' && <span className="badge badge-neutral">{positions.length}</span>}
            </div>
            <div style={{ padding: 'var(--space-2)' }}>
              {activeTab === 'committee' ? (
                positions.map((pos) => (
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
                ))
              ) : (
                <>
                  <button
                    className={`sidebar-link ${selectedPortal === 'turf' ? 'active' : ''}`}
                    onClick={() => setSelectedPortal('turf')}
                    style={{ width: '100%', border: 'none', cursor: 'pointer', background: selectedPortal === 'turf' ? 'var(--accent-primary-soft)' : 'transparent', textAlign: 'left' }}
                  >
                    <span className="sidebar-link-icon">🌱</span>
                    <span>Turf Manager Portal</span>
                    {selectedPortal === 'turf' && (
                      <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--accent-primary)' }}>
                        {portalMappings.filter(m => m.portalType === 'turf').length} mapped
                      </span>
                    )}
                  </button>
                  <button
                    className={`sidebar-link ${selectedPortal === 'shareholder' ? 'active' : ''}`}
                    onClick={() => setSelectedPortal('shareholder')}
                    style={{ width: '100%', border: 'none', cursor: 'pointer', background: selectedPortal === 'shareholder' ? 'var(--accent-primary-soft)' : 'transparent', textAlign: 'left' }}
                  >
                    <span className="sidebar-link-icon">📈</span>
                    <span>Shareholder Portal</span>
                    {selectedPortal === 'shareholder' && (
                      <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--accent-primary)' }}>
                        {portalMappings.filter(m => m.portalType === 'shareholder').length} mapped
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Panel — Modules */}
          <div>
            {!(activeTab === 'committee' ? selectedPosition : selectedPortal) ? (
              <div className="card">
                <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                  <div className="empty-state-icon">👈</div>
                  <div className="empty-state-title">Select a {activeTab === 'committee' ? 'position' : 'portal'}</div>
                  <div className="empty-state-description">
                    Choose from the left panel to view and manage its module mappings.
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
                      <div className="module-card-inner" style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
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
                          onChange={() => handleAccessLevelChange(level.value)}
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
        {activeTab === 'committee'
          ? `All users holding the ${selectedPosName} position will lose access to this module immediately.`
          : `All users in the ${selectedPosName} will lose access to this module immediately.`}
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
