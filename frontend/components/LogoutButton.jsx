"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Signs the current user out and returns them to the login screen. */
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={handleLogout} disabled={loading}>
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
