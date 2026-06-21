import BasePage from '../../superadmin/notifications/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="notifications">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
