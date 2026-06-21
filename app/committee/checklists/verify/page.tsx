import ChecklistVerifyPage from '../../../superadmin/checklists/verify/page';
import PermissionScopedAdminPage from '../../_components/PermissionScopedAdminPage';

export default function CommitteeChecklistVerifyPage() {
  return (
    <PermissionScopedAdminPage moduleKey="daily_operations">
      <ChecklistVerifyPage />
    </PermissionScopedAdminPage>
  );
}
