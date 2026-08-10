import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import { getLandingPathForRole, LOGIN_PATH } from "../lib/roles";

/**
 * Root route: sends an authenticated visitor to their role's landing page,
 * and an unauthenticated visitor to /login.
 */
export default function HomePage() {
  const session = getSession();
  redirect(session ? getLandingPathForRole(session.role) : LOGIN_PATH);
}
