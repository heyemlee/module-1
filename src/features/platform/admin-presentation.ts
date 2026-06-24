import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import type {
  CompanyUserSummary,
  RenderingStat
} from "@/server/platform/user-admin-repository";

export function userSummary(users: CompanyUserSummary[]) {
  return {
    total: users.length,
    active: users.filter((user) => user.disabledAt === null).length,
    disabled: users.filter((user) => user.disabledAt !== null).length,
    admins: users.filter((user) => user.role === "ADMIN").length
  };
}

export function cabinetColorSummary(colors: CabinetColor[]) {
  return {
    total: colors.length,
    active: colors.filter((color) => color.active).length,
    european: colors.filter(
      (color) => color.cabinetStyle === "EUROPEAN_FRAMELESS"
    ).length,
    american: colors.filter(
      (color) => color.cabinetStyle === "AMERICAN_FRAMED"
    ).length
  };
}

export function totalUsageCalls(stats: RenderingStat[]) {
  return stats.reduce((sum, stat) => sum + stat.calls, 0);
}

export function formatUsageDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles"
  }).format(new Date(value));
}
