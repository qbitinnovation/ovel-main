import ReportsPage from '../../superadmin/reports/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeReportsPage() {
  return <PermissionScopedAdminPage moduleKey="reports_analytics"><ReportsPage /></PermissionScopedAdminPage>;
}
