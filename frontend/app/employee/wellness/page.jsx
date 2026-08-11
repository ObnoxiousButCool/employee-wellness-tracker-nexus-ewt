import RoleGuard from "../../../components/RoleGuard";
import WellnessEntryForm from "../../../components/wellness/WellnessEntryForm";
import { ROLES } from "../../../lib/roles";

export default function WellnessEntryPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.EMPLOYEE]}>
      <main>
        <h1>Daily Wellness Check-in</h1>
        <WellnessEntryForm />
        <p>
          <a href="/employee/wellness/history">View your wellness history</a>
        </p>
        <p>
          <a href="/employee/home">Back to home</a>
        </p>
      </main>
    </RoleGuard>
  );
}
