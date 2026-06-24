'use client';

import ComplaintsModule from '@/app/_components/ComplaintsModule';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import PermissionScopedAdminPage from '@/app/committee/_components/PermissionScopedAdminPage';

function CommitteeComplaintsContent() {
  const { checkPermission } = usePermissions();
  
  const canSubmit = checkPermission('complaints', 'submit_complaint');
  const canView = checkPermission('complaints', 'view_complaints');
  const canResolve = checkPermission('complaints', 'resolve_complaint');
  const canViewAnalytics = checkPermission('complaints', 'view_feedback_analytics');

  return (
    <ComplaintsModule 
      canSubmit={canSubmit} 
      canView={canView} 
      canResolve={canResolve} 
      canViewAnalytics={canViewAnalytics} 
    />
  );
}

export default function CommitteeComplaintsPage() {
  return (
    <PermissionScopedAdminPage 
      moduleKey="complaints" 
    >
      <CommitteeComplaintsContent />
    </PermissionScopedAdminPage>
  );
}
