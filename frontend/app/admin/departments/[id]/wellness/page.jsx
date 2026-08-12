import RoleGuard from "../../../../../components/RoleGuard";
import DepartmentWellness from "../../../../../components/wellness/DepartmentWellness";
import { ROLES } from "../../../../../lib/roles";

export default function AdminDepartmentWellnessPage({ params }) {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <main>
        <h1>Department Wellness Score</h1>
        <DepartmentWellness departmentId={params.id} />
      </main>
    </RoleGuard>
  );
}
