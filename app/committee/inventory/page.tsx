import InventoryPage from '../../superadmin/inventory/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeInventoryPage() {
  return <PermissionScopedAdminPage moduleKey="inventory"><InventoryPage /></PermissionScopedAdminPage>;
}
