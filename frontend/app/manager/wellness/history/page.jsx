import RoleGuard from "../../../../components/RoleGuard";
import WellnessHistoryGrid from "../../../../components/wellness/WellnessHistoryGrid";
import { ROLES } from "../../../../lib/roles";

export default function ManagerWellnessHistoryPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.MANAGER]}>
      <main>
        <h1>Team Wellness History</h1>
        <WellnessHistoryGrid role={ROLES.MANAGER} profileBasePath="/manager" />
      </main>
    </RoleGuard>
  );
}
