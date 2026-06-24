'use client';

import ComplaintsModule from '@/app/_components/ComplaintsModule';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

function TurfComplaintsContent() {
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

export default function TurfComplaintsPage() {
  return (
    <PermissionScopedAdminPage 
      moduleKey="complaints" 
    >
      <TurfComplaintsContent />
    </PermissionScopedAdminPage>
  );
}
