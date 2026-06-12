import AccountsPage from '../../superadmin/accounts/page';
import PermissionScopedAdminPage from '../_components/PermissionScopedAdminPage';

export default function CommitteeAccountsPage() {
  return <PermissionScopedAdminPage moduleKey="accounts_finance"><AccountsPage /></PermissionScopedAdminPage>;
}
