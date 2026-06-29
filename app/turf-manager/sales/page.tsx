import BasePage from '../../superadmin/sales/manage/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="inventory_sales">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
