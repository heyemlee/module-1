import { describe, expect, test } from "vitest";
import type { CompanyUserSummary, RenderingStat } from "@/server/platform/user-admin-repository";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import {
  cabinetColorSummary,
  formatUsageDate,
  totalUsageCalls,
  userSummary
} from "./admin-presentation";

const users: CompanyUserSummary[] = [
  {
    id: "admin-1",
    companyId: "company-1",
    account: "admin",
    name: "Admin",
    role: "ADMIN",
    monthlyRenderQuota: 100,
    disabledAt: null,
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "sales-1",
    companyId: "company-1",
    account: "sales",
    name: "Sales",
    role: "SALES",
    monthlyRenderQuota: 50,
    disabledAt: "2026-06-20T00:00:00.000Z",
    createdAt: "2026-06-02T00:00:00.000Z"
  }
];

const colors = [
  {
    id: "eu-1",
    companyId: "company-1",
    cabinetStyle: "EUROPEAN_FRAMELESS",
    name: "Oak",
    colorCode: null,
    swatchImageUrl: null,
    swatchHex: "#b98b61",
    hoverExampleImageUrl: null,
    promptDescription: "oak",
    active: true,
    sortOrder: 1,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "us-1",
    companyId: "company-1",
    cabinetStyle: "AMERICAN_FRAMED",
    name: "White",
    colorCode: null,
    swatchImageUrl: null,
    swatchHex: "#ffffff",
    hoverExampleImageUrl: null,
    promptDescription: "white paint",
    active: false,
    sortOrder: 2,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  }
] satisfies CabinetColor[];

describe("admin presentation", () => {
  test("summarizes users from repository data", () => {
    expect(userSummary(users)).toEqual({
      total: 2,
      active: 1,
      disabled: 1,
      admins: 1
    });
  });

  test("summarizes cabinet colors by style and status", () => {
    expect(cabinetColorSummary(colors)).toEqual({
      total: 2,
      active: 1,
      european: 1,
      american: 1
    });
  });

  test("totals usage calls", () => {
    const stats: RenderingStat[] = [
      { date: "2026-06-24T10:00:00.000Z", calls: 3 },
      { date: "2026-06-23T10:00:00.000Z", calls: 2 }
    ];
    expect(totalUsageCalls(stats)).toBe(5);
  });

  test("formats usage dates with a fixed locale and timezone", () => {
    expect(formatUsageDate("2026-06-24T17:30:00.000Z")).toBe(
      "Jun 24, 2026, 10:30 AM"
    );
  });
});
