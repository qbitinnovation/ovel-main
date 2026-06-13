import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function ReportsAliasPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/community/login?callbackUrl=/reports');
  }

  if (session.user.portalType === 'superadmin') redirect('/superadmin/reports');
  if (session.user.portalType === 'committee') redirect('/committee/reports');
  if (session.user.portalType === 'shareholder') redirect('/shareholder/reports');

  redirect('/turf-manager/dashboard');
}
