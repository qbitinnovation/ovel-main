import ManageBookingsPage from '../../../superadmin/bookings/manage/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function TurfManagerManageBookingsPage() {
  return <PermissionScopedAdminPage moduleKey="bookings"><ManageBookingsPage /></PermissionScopedAdminPage>;
}
