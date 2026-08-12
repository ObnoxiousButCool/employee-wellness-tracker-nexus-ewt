import RoleGuard from "../../../../components/RoleGuard";
import WellnessDashboard from "../../../../components/wellness/WellnessDashboard";
import { ROLES } from "../../../../lib/roles";

export default function AdminWellnessScoresPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <main>
        <h1>Wellness Scores</h1>
        <WellnessDashboard role={ROLES.ADMIN} profileBasePath="/admin" />
      </main>
    </RoleGuard>
  );
}
