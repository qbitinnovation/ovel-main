import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PORTAL_ROUTES } from '@/lib/constants';
import type { PortalType } from '@/lib/constants';

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const portalType = (session.user.portalType || 'committee') as PortalType;
  const portalPath = PORTAL_ROUTES[portalType] || '/committee';
  redirect(`${portalPath}/dashboard`);
}
