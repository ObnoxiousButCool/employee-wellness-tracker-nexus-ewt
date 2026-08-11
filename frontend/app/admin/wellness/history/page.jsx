import RoleGuard from "../../../../components/RoleGuard";
import WellnessHistoryGrid from "../../../../components/wellness/WellnessHistoryGrid";
import { ROLES } from "../../../../lib/roles";

export default function AdminWellnessHistoryPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <main>
        <h1>Wellness History</h1>
        <WellnessHistoryGrid role={ROLES.ADMIN} profileBasePath="/admin" />
      </main>
    </RoleGuard>
  );
}
