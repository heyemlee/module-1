"use client";

import { usePathname } from "next/navigation";
import { StudioRail } from "./studio-shell";

export function GlobalSidebar({
  userName,
  userRole,
  isAdmin,
  isOwner
}: {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  isOwner: boolean;
}) {
  const pathname = usePathname() || "";

  let activeItem:
    | "projects"
    | "overview"
    | "round1"
    | "round2"
    | "renderings"
    | "users"
    | "colors" = "projects";
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
      } else if (parts[3] === "round2") {
        activeItem = "round2";
      } else if (parts[3] === "renderings") {
        activeItem = "renderings";
      } else {
        activeItem = "overview";
      }
    } else {
      activeItem = "projects";
    }
  }

  return (
    <StudioRail
      userName={userName}
      userRole={userRole}
      isAdmin={isAdmin}
      isOwner={isOwner}
      activeItem={activeItem}
      projectId={projectId}
    />
  );
}
