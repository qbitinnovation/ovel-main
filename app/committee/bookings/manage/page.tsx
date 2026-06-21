import ManageBookingsPage from '../../../superadmin/bookings/manage/page';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function CommitteeManageBookingsPage() {
  return <PermissionScopedAdminPage moduleKey="bookings"><ManageBookingsPage /></PermissionScopedAdminPage>;
}
