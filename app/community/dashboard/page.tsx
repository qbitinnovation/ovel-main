import type { Metadata } from 'next';
import PortalDashboard from '@/components/dashboard/PortalDashboard';

export const metadata: Metadata = {
  title: 'Community Dashboard',
};

export default function CommunityDashboardPage() {
  return <PortalDashboard portalName="Community Member" portalBase="/community" />;
}
