import RoleGuard from "../../../../components/RoleGuard";
import EmployeeProfile from "../../../../components/wellness/EmployeeProfile";
import { ROLES } from "../../../../lib/roles";

export default function ManagerEmployeeProfilePage({ params }) {
  return (
    <RoleGuard allowedRoles={[ROLES.MANAGER]}>
      <main>
        <EmployeeProfile employeeId={params.id} />
      </main>
    </RoleGuard>
  );
}
