"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PersonIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function NavPill({
  href,
  active = false,
  children
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center rounded-studio-control px-4 text-[11px] font-semibold transition-colors",
        active
          ? "bg-studio-action text-studio-action-ink"
          : "border border-studio-line bg-studio-surface text-studio-muted hover:border-studio-line-strong hover:bg-studio-raised hover:text-studio-ink"
      )}
    >
      {children}
    </Link>
  );
}

/** Studio project bar: brand · project navigation · account menu. */
export function PlatformHeader({ userName, nav }: { userName: string; nav: ReactNode }) {
  const [signingOut, setSigningOut] = useState(false);

  const logout = async () => {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.href = "/login";
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <header className="border-b border-studio-line bg-studio-shell/95 text-studio-ink backdrop-blur">
      <div className="mx-auto flex h-[74px] max-w-[1320px] items-center gap-6 px-8">
        <Link href="/projects" className="text-[16px] font-bold text-studio-ink">
          ABCabinet
        </Link>
        <nav className="flex items-center gap-2">{nav}</nav>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-studio-control py-1 pl-1 pr-3 outline-none transition-colors hover:bg-studio-raised focus-visible:ring-2 focus-visible:ring-studio-action/70">
              <span className="flex size-8 items-center justify-center rounded-full bg-studio-surface text-studio-action">
                <PersonIcon className="size-4" />
              </span>
              <span className="text-[13px] font-semibold text-studio-ink">{userName}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem disabled={signingOut} onSelect={() => void logout()}>
                {signingOut ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
