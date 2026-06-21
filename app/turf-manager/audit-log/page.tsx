import BasePage from '../../superadmin/audit-log/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="audit_log">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
