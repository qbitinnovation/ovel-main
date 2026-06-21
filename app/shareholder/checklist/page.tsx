import BasePage from '../../superadmin/checklists/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="daily_operations">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
