import ChecklistsPage from '../../superadmin/checklists/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeChecklistsPage() {
  return <PermissionScopedAdminPage moduleKey="daily_operations"><ChecklistsPage /></PermissionScopedAdminPage>;
}
