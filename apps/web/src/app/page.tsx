import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@transport/shared-types';
import { authOptions } from '../lib/auth-options';

export const dynamic = 'force-dynamic';

export default async function RootPage(): Promise<never> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/login');
  }

  // Determine user role and redirect to the correct dashboard
  const user = session.user as { role?: UserRole; name?: string; email?: string };
  const role = user.role || UserRole.PASSENGER;

  switch (role) {
    case UserRole.PASSENGER:
      redirect('/passenger/dashboard');
      break;
    case UserRole.DRIVER:
      redirect('/driver/dashboard');
      break;
    case UserRole.MANAGER:
      redirect('/manager/dashboard');
      break;
    case UserRole.COMPANY_LEAD:
      redirect('/company/dashboard');
      break;
    default:
      redirect('/login');
      break;
  }
}
