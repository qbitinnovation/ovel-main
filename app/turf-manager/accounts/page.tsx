import BasePage from '../../superadmin/accounts/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="accounts_finance">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
