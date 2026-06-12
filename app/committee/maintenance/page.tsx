import MaintenancePage from '../../superadmin/maintenance/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeMaintenancePage() {
  return <PermissionScopedAdminPage moduleKey="maintenance_tasks"><MaintenancePage /></PermissionScopedAdminPage>;
}
