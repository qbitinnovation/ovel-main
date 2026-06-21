'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ChecklistUploadPage from './upload/page';
import ChecklistVerifyPage from './verify/page';

export default function ChecklistsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'upload' | 'verify'>('verify');
  const [canUpload, setCanUpload] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccess() {
      try {
        const res = await fetch('/api/users/me/access');
        if (res.ok) {
          const data = await res.json();
          const moduleAccess = data.data?.find((m: any) => m.moduleKey === 'daily_operations');
          if (moduleAccess?.accessLevel === 'full_control') {
            setCanUpload(true);
            setCanVerify(true);
            setActiveTab('verify');
          } else if (moduleAccess?.enabledActions) {
            const hasUpload = moduleAccess.enabledActions.includes('upload_checklist');
            const hasVerify = moduleAccess.enabledActions.some((a: string) => ['view_checklist', 'verify_checklist', 'approve_checklist', 'reject_checklist'].includes(a));
            setCanUpload(hasUpload);
            setCanVerify(hasVerify);
            if (hasUpload && !hasVerify) setActiveTab('upload');
            else if (hasVerify && !hasUpload) setActiveTab('verify');
            else if (hasUpload && hasVerify) setActiveTab('verify');
          }
        }
      } catch (error) {
        console.error('Failed to fetch module access:', error);
      } finally {
        setLoading(false);
      }
    }
    if (session?.user) {
      if (session.user.portalType === 'superadmin') {
         setCanUpload(true);
         setCanVerify(true);
         setActiveTab('verify');
         setLoading(false);
      } else {
         fetchAccess();
      }
    }
  }, [session]);

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner spinner-lg" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Checklists</h1>
          <p className="page-subtitle">Review daily staff submissions and upload proof photos</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-2)' }}>
        {canUpload && (
          <button
            className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setActiveTab('upload')}
          >
            Checklist Upload
          </button>
        )}
        {canVerify && (
          <button
            className={`btn ${activeTab === 'verify' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setActiveTab('verify')}
          >
            Checklist Verification
          </button>
        )}
      </div>

      <div>
        {activeTab === 'upload' && canUpload && <ChecklistUploadPage />}
        {activeTab === 'verify' && canVerify && <ChecklistVerifyPage />}
      </div>
    </div>
  );
}
