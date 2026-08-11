import RoleGuard from "../../../../components/RoleGuard";
import WellnessHistory from "../../../../components/wellness/WellnessHistory";
import { ROLES } from "../../../../lib/roles";

export default function WellnessHistoryPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.EMPLOYEE]}>
      <main>
        <h1>Wellness History</h1>
        <WellnessHistory />
        <p>
          <a href="/employee/wellness">Back to check-in</a>
        </p>
      </main>
    </RoleGuard>
  );
}
