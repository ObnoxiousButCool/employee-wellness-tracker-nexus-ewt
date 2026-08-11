import { Suspense } from "react";
import RoleGuard from "../../../components/RoleGuard";
import LogoutButton from "../../../components/LogoutButton";
import UserManagement from "../../../components/admin/UserManagement";
import { ROLES } from "../../../lib/roles";

export default function AdminUsersPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <main>
        <h1>Manage Users</h1>
        {/* UserManagement reads the ?department= filter via useSearchParams, which requires a Suspense boundary. */}
        <Suspense fallback={<p role="status">Loading users…</p>}>
          <UserManagement />
        </Suspense>
        <LogoutButton />
      </main>
    </RoleGuard>
  );
}
