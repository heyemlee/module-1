"use client";

import { usePathname } from "next/navigation";
import { StudioRail } from "./studio-shell";

export function GlobalSidebar({
  userName,
  isAdmin,
}: {
  userName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname() || "";

  let activeItem: "projects" | "round1" | "renderings" | "users" | "colors" = "projects";
  let projectId: string | undefined;

  if (pathname.startsWith("/admin/users")) {
    activeItem = "users";
  } else if (pathname.startsWith("/admin/cabinet-colors")) {
    activeItem = "colors";
  } else if (pathname.startsWith("/projects")) {
    const parts = pathname.split("/");
    // path is usually /projects/[id]/round1
    if (parts.length >= 3 && parts[2] !== "new") {
      projectId = parts[2];
      if (parts[3] === "round1") {
        activeItem = "round1";
      } else if (parts[3] === "renderings") {
        activeItem = "renderings";
      } else {
        activeItem = "projects";
      }
    } else {
      activeItem = "projects";
    }
  }

  // The Round1 workspace has its own mode tracking which can collapse the sidebar.
  // For the global sidebar outside of that specific workspace integration, 
  // we'll keep it expanded by default.
  return (
    <StudioRail
      userName={userName}
      isAdmin={isAdmin}
      activeItem={activeItem}
      projectId={projectId}
      compact={false}
    />
  );
}
