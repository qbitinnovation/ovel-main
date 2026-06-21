import ChecklistUploadPage from '../../../superadmin/checklists/upload/page';
import PermissionScopedAdminPage from '../../_components/PermissionScopedAdminPage';

export default function CommitteeChecklistUploadPage() {
  return (
    <PermissionScopedAdminPage moduleKey="daily_operations" requiredAction="upload_checklist">
      <ChecklistUploadPage />
    </PermissionScopedAdminPage>
  );
}
