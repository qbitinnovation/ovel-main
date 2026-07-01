import type { Metadata } from 'next';
import PortalDashboard from '@/components/dashboard/PortalDashboard';

export const metadata: Metadata = {
  title: 'SuperAdmin Dashboard',
};

export default function SuperAdminDashboardPage() {
  return <PortalDashboard portalName="Super Admin" portalBase="/superadmin" />;
}
