import BasePage from '../../superadmin/reports/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="reports_analytics">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
