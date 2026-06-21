import BasePage from '../../superadmin/bookings/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="bookings">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
