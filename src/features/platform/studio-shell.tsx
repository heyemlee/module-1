"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type StudioNavItem =
  | "projects"
  | "overview"
  | "round1"
  | "renderings"
  | "users"
  | "colors";

type RailSection = "workspace" | "project" | "admin";

const SECTION_LABEL: Record<RailSection, string> = {
  workspace: "WORKSPACE",
  project: "PROJECT",
  admin: "ADMIN"
};

export function StudioRail({
  userName,
  userRole = "",
  isAdmin,
  activeItem,
  projectId
}: {
  userName: string;
  userRole?: string;
  isAdmin: boolean;
  activeItem: StudioNavItem;
  projectId?: string;
}) {
  const [signingOut, setSigningOut] = useState(false);

  // The rail only knows the active project id (from the URL), so fetch its name
  // for the "PROJECT · <name>" section header.
  const [projectName, setProjectName] = useState<string | null>(null);
  useEffect(() => {
    if (!projectId) {
      setProjectName(null);
      return;
    }
    let cancelled = false;
    setProjectName(null);
    fetch(`/api/projects/${projectId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setProjectName(data?.project?.projectName ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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

  const initials =
    userName
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—";

  const items: {
    id: StudioNavItem;
    href: string;
    label: string;
    section: RailSection;
    visible: boolean;
  }[] = [
    {
      id: "projects",
      href: "/projects",
      label: "Projects",
      section: "workspace",
      visible: true
    },
    {
      id: "overview",
      href: projectId ? `/projects/${projectId}` : "/projects",
      label: "Overview",
      section: "project",
      visible: Boolean(projectId)
    },
    {
      id: "round1",
      href: projectId ? `/projects/${projectId}/round1` : "/projects",
      label: "Round 1",
      section: "project",
      visible: Boolean(projectId)
    },
    {
      id: "renderings",
      href: projectId ? `/projects/${projectId}/renderings` : "/projects",
      label: "Renderings",
      section: "project",
      visible: Boolean(projectId)
    },
    {
      id: "users",
      href: "/admin/users",
      label: "Users",
      section: "admin",
      visible: isAdmin
    },
    {
      id: "colors",
      href: "/admin/cabinet-colors",
      label: "Cabinet Colors",
      section: "admin",
      visible: isAdmin
    }
  ];

  const sections: RailSection[] = ["workspace", "project", "admin"];

  return (
    <aside className="studio-glass-rail sticky top-0 z-30 flex h-[100dvh] w-[236px] flex-col">
      <Link
        href="/projects"
        className="flex items-center gap-2.5 border-b border-[rgba(20,20,26,0.07)] px-[22px] pb-[18px] pt-[22px]"
      >
        <span
          aria-hidden
          className="relative size-[13px] shrink-0 rounded-[4px] border-[1.5px] border-studio-ink"
        >
          <span className="absolute inset-[2.5px] rounded-[1px] bg-studio-ink" />
        </span>
        <span className="font-mono text-[11px] tracking-[0.3em] text-studio-ink">
          ABCABINET
        </span>
      </Link>

      <nav
        aria-label="Primary navigation"
        className="flex flex-col gap-[3px] px-3 py-4"
      >
        {sections.map((section) => {
          const sectionItems = items.filter(
            (item) => item.section === section && item.visible
          );
          if (sectionItems.length === 0) return null;
          return (
            <Fragment key={section}>
              <p className="truncate px-3 pb-1.5 pt-1 font-mono text-[9.5px] tracking-[0.18em] text-[#a4a49e]">
                {section === "project" && projectName
                  ? `${SECTION_LABEL[section]} · ${projectName.toUpperCase()}`
                  : SECTION_LABEL[section]}
              </p>
              {sectionItems.map((item) => {
                const active = activeItem === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-[11px] rounded-[12px] border px-3 py-2.5 text-[13px] transition-colors",
                      active
                        ? "border-white/90 bg-white/90 font-semibold text-[#16161a] shadow-[inset_0_1px_0_#fff,0_8px_18px_-10px_rgba(20,20,26,0.32)]"
                        : "border-transparent font-medium text-[#73736e] hover:bg-white/50 hover:text-[#16161a]"
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-[6px] shrink-0 rounded-full border border-current"
                      style={{ background: active ? "#1a1a1c" : "transparent" }}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </Fragment>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[rgba(20,20,26,0.07)] p-[14px]">
        <div className="flex items-center gap-[11px] rounded-[14px] border border-white/75 bg-white/55 p-[9px] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            style={{ background: "linear-gradient(150deg,#2c2c30,#141416)" }}
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[12.5px] font-semibold text-studio-ink">
              {userName}
            </span>
            {userRole && (
              <span className="block font-mono text-[9.5px] tracking-[0.1em] text-[#86867f]">
                {userRole}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={signingOut}
            title="Sign out"
            aria-label="Sign out"
            className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border border-white/85 bg-white/60 text-[13px] leading-none text-[#6a6a64] transition-colors hover:text-studio-ink disabled:opacity-50"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}
