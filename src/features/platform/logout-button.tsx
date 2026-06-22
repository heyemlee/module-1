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
      className="rounded border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
