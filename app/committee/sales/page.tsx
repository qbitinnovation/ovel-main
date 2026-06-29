import SalesPage from '../../superadmin/sales/manage/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeSalesPage() {
  return <PermissionScopedAdminPage moduleKey="inventory_sales"><SalesPage /></PermissionScopedAdminPage>;
}
