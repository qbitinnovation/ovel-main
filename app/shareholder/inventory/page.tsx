import BasePage from '../../superadmin/inventory/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="inventory">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
