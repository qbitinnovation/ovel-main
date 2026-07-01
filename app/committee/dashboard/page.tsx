import type { Metadata } from 'next';
import PortalDashboard from '@/components/dashboard/PortalDashboard';

export const metadata: Metadata = {
  title: 'Committee Dashboard',
};

export default function CommitteeDashboardPage() {
  return <PortalDashboard portalName="Committee Member" portalBase="/committee" />;
}
