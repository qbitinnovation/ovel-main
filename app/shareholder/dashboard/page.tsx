import type { Metadata } from 'next';
import PortalDashboard from '@/components/dashboard/PortalDashboard';

export const metadata: Metadata = {
  title: 'Shareholder Dashboard',
};

export default function ShareholderDashboardPage() {
  return <PortalDashboard portalName="Shareholder" portalBase="/shareholder" />;
}
