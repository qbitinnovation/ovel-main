import ManageBookingsPage from '../../../superadmin/bookings/manage/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function ShareholderManageBookingsPage() {
  return <PermissionScopedAdminPage moduleKey="bookings"><ManageBookingsPage /></PermissionScopedAdminPage>;
}
