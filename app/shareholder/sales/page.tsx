import BasePage from '../../superadmin/sales/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="inventory_sales">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
