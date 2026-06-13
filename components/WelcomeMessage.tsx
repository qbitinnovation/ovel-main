import { auth } from '@/lib/auth';
import { getAuthRoleLabel } from '@/lib/portal-auth';
import { getInitials } from '@/lib/utils';

export default async function WelcomeMessage() {
  const session = await auth();
  if (!session?.user) return null;

  const name = session.user.name || 'User';
  const role = session.user.positionName || session.user.roleLabel || getAuthRoleLabel(session.user.role);
  const organizationName = session.user.organizationName || 'Oval Turf';
  const message = `Welcome ${name}, the ${role} of ${organizationName}`;

  return (
    <section
      className="welcome-banner"
      aria-label={message}
    >
      <div className="welcome-avatar" aria-hidden="true">
        {getInitials(name)}
      </div>

      <div className="welcome-content">
        <div className="welcome-message">
          Welcome <span>{name}</span>,<br />
          the {role} of {organizationName}
        </div>
      </div>
    </section>
  );
}
