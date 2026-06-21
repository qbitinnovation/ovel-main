import BasePage from '../../superadmin/maintenance/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="maintenance_tasks">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
