import type { Metadata } from 'next';
import PortalDashboard from '@/components/dashboard/PortalDashboard';

export const metadata: Metadata = {
  title: 'Turf Manager Dashboard',
};

export default function TurfManagerDashboardPage() {
  return <PortalDashboard portalName="Turf Manager" portalBase="/turf-manager" />;
}
