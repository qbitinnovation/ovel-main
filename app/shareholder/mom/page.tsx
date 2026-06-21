import BasePage from '../../superadmin/mom/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="malayalam_mom">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
