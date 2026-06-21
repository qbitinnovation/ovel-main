import BasePage from '../../superadmin/users/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="user_permission">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
