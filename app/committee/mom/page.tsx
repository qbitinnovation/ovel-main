import MomPage from '../../superadmin/mom/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeMomPage() {
  return <PermissionScopedAdminPage moduleKey="malayalam_mom"><MomPage /></PermissionScopedAdminPage>;
}
