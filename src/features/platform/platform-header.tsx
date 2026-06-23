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
        "inline-flex h-7 items-center rounded-full px-4 text-[11px] font-bold transition-colors",
        active
          ? "bg-[#1d1d1f] text-white"
          : "border border-[#d2d2d7] bg-white text-[#1d1d1f] hover:border-[#1d1d1f]/40"
      )}
    >
      {children}
    </Link>
  );
}

/** Cream "Motion Style" top bar: brand · nav pills · account menu with sign out. */
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
    <header className="sticky top-0 z-10 border-b border-[#d2d2d7] bg-[#f5f5f7]/95 backdrop-blur">
      <div className="mx-auto flex h-[74px] max-w-[1320px] items-center gap-6 px-8">
        <Link href="/projects" className="text-[16px] font-bold text-[#1d1d1f]">
          ABC Cabinet
        </Link>
        <nav className="flex items-center gap-2">{nav}</nav>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#1d1d1f]/15">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#1d1d1f] text-white">
                <PersonIcon className="size-4" />
              </span>
              <span className="text-[13px] font-semibold text-[#1d1d1f]">{userName}</span>
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
