"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ColorWheelIcon,
  DashboardIcon,
  DrawingPinIcon,
  ImageIcon,
  PersonIcon
} from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type StudioNavItem =
  | "projects"
  | "round1"
  | "renderings"
  | "users"
  | "colors";

export function StudioRail({
  userName,
  isAdmin,
  activeItem,
  projectId,
  compact = false
}: {
  userName: string;
  isAdmin: boolean;
  activeItem: StudioNavItem;
  projectId?: string;
  compact?: boolean;
}) {
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

  const items = [
    {
      id: "projects" as const,
      href: "/projects",
      label: "Projects",
      icon: DashboardIcon,
      visible: true
    },
    {
      id: "round1" as const,
      href: projectId ? `/projects/${projectId}/round1` : "/projects",
      label: "Round 1",
      icon: DrawingPinIcon,
      visible: Boolean(projectId)
    },
    {
      id: "renderings" as const,
      href: projectId ? `/projects/${projectId}/renderings` : "/projects",
      label: "Renderings",
      icon: ImageIcon,
      visible: Boolean(projectId)
    },
    {
      id: "users" as const,
      href: "/admin/users",
      label: "Users",
      icon: PersonIcon,
      visible: isAdmin
    },
    {
      id: "colors" as const,
      href: "/admin/cabinet-colors",
      label: "Cabinet colors",
      icon: ColorWheelIcon,
      visible: isAdmin
    }
  ];

  return (
    <aside className="sticky top-0 flex h-[100dvh] flex-col border-r border-studio-line bg-[#0e1713] p-3">
      <Link
        href="/projects"
        className={cn(
          "mb-6 flex h-10 items-center gap-2 rounded-studio-control px-2 text-[13px] font-semibold text-studio-ink",
          compact && "justify-center px-0"
        )}
      >
        <span className="size-6 rounded-[7px] bg-studio-action" aria-hidden />
        {!compact && "ABCabinet"}
      </Link>
      <nav aria-label="Primary navigation" className="grid gap-1">
        {items.filter((item) => item.visible).map((item) => {
          const Icon = item.icon;
          const active = activeItem === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={compact ? item.label : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-studio-control px-3 text-[12px] font-medium transition-colors",
                compact && "justify-center px-0",
                active
                  ? "bg-studio-surface text-studio-ink"
                  : "text-studio-muted hover:bg-white/[0.05] hover:text-studio-ink"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {!compact && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "mt-auto flex min-h-10 items-center gap-2 rounded-studio-control border-t border-studio-line px-2 pt-3 text-[11px] text-studio-muted transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-white/20 outline-none",
            compact ? "justify-center" : "w-full"
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-studio-surface text-studio-action">
            <PersonIcon className="size-3.5" aria-hidden />
          </span>
          {!compact && <span className="truncate">{userName}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={compact ? "center" : "end"} side="right" sideOffset={8} className="min-w-[160px]">
          <DropdownMenuItem disabled={signingOut} onSelect={() => void logout()}>
            {signingOut ? "Signing out..." : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
