import RoleGuard from "../../../components/RoleGuard";
import LogoutButton from "../../../components/LogoutButton";
import { getSession } from "../../../lib/session";
import { ROLES } from "../../../lib/roles";

export default function EmployeeHomePage() {
  return (
    <RoleGuard allowedRoles={[ROLES.EMPLOYEE]}>
      <EmployeeHomeContent />
    </RoleGuard>
  );
}

function EmployeeHomeContent() {
  const session = getSession();
  return (
    <main>
      <h1>Employee Home</h1>
      <p>Signed in as user #{session.userId} (EMPLOYEE).</p>
      <LogoutButton />
    </main>
  );
}
