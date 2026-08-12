import RoleGuard from "../../../../components/RoleGuard";
import WellnessDashboard from "../../../../components/wellness/WellnessDashboard";
import { ROLES } from "../../../../lib/roles";

export default function ManagerWellnessScoresPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.MANAGER]}>
      <main>
        <h1>Team Wellness Scores</h1>
        <WellnessDashboard role={ROLES.MANAGER} profileBasePath="/manager" />
      </main>
    </RoleGuard>
  );
}
