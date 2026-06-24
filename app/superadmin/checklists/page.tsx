'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import ChecklistUploadPage from './upload/page';
import ChecklistVerifyPage from './verify/page';

export default function ChecklistsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'upload' | 'verify'>('verify');
  const [canUpload, setCanUpload] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  const [loading, setLoading] = useState(true);

  const { checkPermission, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (session?.user?.portalType === 'superadmin') {
      setCanUpload(true);
      setCanVerify(true);
      setActiveTab('verify');
      setLoading(false);
    } else if (!permissionsLoading) {
      const hasUpload = checkPermission('daily_operations', 'upload_checklist');
      const hasVerify = checkPermission('daily_operations', 'verify_checklist') ||
                        checkPermission('daily_operations', 'approve_checklist') ||
                        checkPermission('daily_operations', 'reject_checklist') ||
                        (checkPermission('daily_operations', 'view_checklist') && !hasUpload);
      
      setCanUpload(hasUpload);
      setCanVerify(hasVerify);
      if (hasUpload && !hasVerify) setActiveTab('upload');
      else if (hasVerify && !hasUpload) setActiveTab('verify');
      else if (hasUpload && hasVerify) setActiveTab('verify');
      setLoading(false);
    }
  }, [session, permissionsLoading, checkPermission]);

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner spinner-lg" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Checklists</h1>
          <p className="page-subtitle">Review daily staff submissions and upload proof photos</p>
        </div>
      </div>

      {canUpload && canVerify && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-2)' }}>
          <button
            className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setActiveTab('upload')}
          >
            Checklist Upload
          </button>
          <button
            className={`btn ${activeTab === 'verify' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setActiveTab('verify')}
          >
            Checklist Verification
          </button>
        </div>
      )}

      <div>
        {activeTab === 'upload' && canUpload && <ChecklistUploadPage />}
        {activeTab === 'verify' && canVerify && <ChecklistVerifyPage />}
      </div>
    </div>
  );
}
