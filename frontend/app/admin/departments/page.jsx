import RoleGuard from "../../../components/RoleGuard";
import LogoutButton from "../../../components/LogoutButton";
import DepartmentManagement from "../../../components/admin/DepartmentManagement";
import { ROLES } from "../../../lib/roles";

export default function AdminDepartmentsPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <main>
        <h1>Manage Departments</h1>
        <DepartmentManagement />
        <LogoutButton />
      </main>
    </RoleGuard>
  );
}
