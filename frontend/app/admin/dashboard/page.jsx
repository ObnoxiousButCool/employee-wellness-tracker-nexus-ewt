import RoleGuard from "../../../components/RoleGuard";
import LogoutButton from "../../../components/LogoutButton";
import { getSession } from "../../../lib/session";
import { ROLES } from "../../../lib/roles";

export default function AdminDashboardPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <AdminDashboardContent />
    </RoleGuard>
  );
}

function AdminDashboardContent() {
  const session = getSession();
  return (
    <main>
      <h1>Admin Dashboard</h1>
      <p>Signed in as user #{session.userId} (ADMIN).</p>
      <LogoutButton />
    </main>
  );
}
