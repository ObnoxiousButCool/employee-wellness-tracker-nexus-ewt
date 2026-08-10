import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import { resolveAccess } from "../lib/roles";

/**
 * Server-component route guard. Wraps a protected page's content; redirects
 * unauthenticated visitors (or visitors whose role isn't in `allowedRoles`)
 * to /login before any protected content is rendered.
 * @param {{allowedRoles: string[], children: import("react").ReactNode}} props
 */
export default function RoleGuard({ allowedRoles, children }) {
  const session = getSession();
  const access = resolveAccess(session, allowedRoles);

  if (!access.allowed) {
    redirect(access.redirectTo);
  }

  return children;
}
