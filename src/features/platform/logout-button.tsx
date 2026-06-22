"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <Button variant="secondary" size="sm" onClick={logout} disabled={busy}>
      <LogOut size={14} />
      {busy ? "Signing out..." : "Sign out"}
    </Button>
  );
}
