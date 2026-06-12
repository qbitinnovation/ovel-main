import NotificationsPage from '../../superadmin/notifications/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeNotificationsPage() {
  return <PermissionScopedAdminPage moduleKey="notifications"><NotificationsPage /></PermissionScopedAdminPage>;
}
