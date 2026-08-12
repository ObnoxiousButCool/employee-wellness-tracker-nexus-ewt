import RoleGuard from "../../../../components/RoleGuard";
import DepartmentWellness from "../../../../components/wellness/DepartmentWellness";
import { getSession } from "../../../../lib/session";
import { ROLES } from "../../../../lib/roles";

export default function ManagerDepartmentWellnessPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.MANAGER]}>
      <ManagerDepartmentWellnessContent />
    </RoleGuard>
  );
}

function ManagerDepartmentWellnessContent() {
  const session = getSession();

  return (
    <main>
      <h1>Department Wellness Score</h1>
      {session.departmentId == null ? (
        <p>You are not assigned to a department.</p>
      ) : (
        <DepartmentWellness departmentId={session.departmentId} />
      )}
    </main>
  );
}
