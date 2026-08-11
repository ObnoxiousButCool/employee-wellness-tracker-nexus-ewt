import RoleGuard from "../../../../components/RoleGuard";
import EmployeeProfile from "../../../../components/wellness/EmployeeProfile";
import { ROLES } from "../../../../lib/roles";

export default function AdminEmployeeProfilePage({ params }) {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <main>
        <EmployeeProfile employeeId={params.id} />
      </main>
    </RoleGuard>
  );
}
