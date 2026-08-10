import RoleGuard from "../../../components/RoleGuard";
import LogoutButton from "../../../components/LogoutButton";
import { getSession } from "../../../lib/session";
import { ROLES } from "../../../lib/roles";

export default function ManagerDashboardPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.MANAGER]}>
      <ManagerDashboardContent />
    </RoleGuard>
  );
}

function ManagerDashboardContent() {
  const session = getSession();
  return (
    <main>
      <h1>Manager Dashboard</h1>
      <p>Signed in as user #{session.userId} (MANAGER).</p>
      <LogoutButton />
    </main>
  );
}
