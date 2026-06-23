"use client";

import { useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.href = "/login";
    } catch {
      // Re-enable so the user can retry instead of being stuck on "Signing out…",
      // and don't redirect as if signed out when the session wasn't cleared.
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="uiverse-fill-button px-3 py-2"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
