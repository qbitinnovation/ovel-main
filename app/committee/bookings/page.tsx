import BookingsPage from '../../superadmin/bookings/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeBookingsPage() {
  return <PermissionScopedAdminPage moduleKey="bookings"><BookingsPage /></PermissionScopedAdminPage>;
}
