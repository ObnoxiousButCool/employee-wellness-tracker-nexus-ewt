import Link from "next/link";
import RoleGuard from "../../../components/RoleGuard";
import LogoutButton from "../../../components/LogoutButton";
import DashboardSummary from "../../../components/dashboard/DashboardSummary";
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
      <nav>
        <Link href="/manager/wellness/history">Team Wellness History</Link>
        <Link href="/manager/wellness/scores">Team Wellness Scores</Link>
        <Link href="/manager/department/wellness">Department Wellness Score</Link>
      </nav>
      <LogoutButton />
      <DashboardSummary role="MANAGER" />
    </main>
  );
}
