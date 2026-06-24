import { redirect } from 'next/navigation';

export default function SuperAdminAttendanceRedirect() {
  redirect('/superadmin/attendance/verify');
}
