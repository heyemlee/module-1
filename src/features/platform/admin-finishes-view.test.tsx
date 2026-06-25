import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { CabinetColorsAdminView } from "./cabinet-colors-admin-view";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

vi.mock("./cabinet-colors-manager", () => ({
  CabinetColorsManager: () => <div data-testid="manager" />
}));

vi.mock("./cabinet-color-form", () => ({
  CabinetColorForm: () => <div data-testid="form" />
}));

const baseFinish: Omit<CabinetColor, "id" | "name" | "active"> = {
  companyId: "c1",
  cabinetStyle: "EUROPEAN_FRAMELESS",
  colorCode: "C1",
  swatchImageUrl: null,
  swatchHex: "#fff",
  hoverExampleImageUrl: null,
  promptDescription: "A color",
  sortOrder: 1,
  createdAt: "",
  updatedAt: ""
};

const finishes: CabinetColor[] = [
  ...Array.from({ length: 12 }).map((_, i) => ({
    ...baseFinish,
    id: `c-${i}`,
    name: `Color ${i}`,
    active: true
  })),
  {
    ...baseFinish,
    id: "c-hidden",
    name: "Hidden Color",
    active: false
  }
];

describe("CabinetColorsAdminView", () => {
  test("renders Studio page structure and real summary counts", () => {
    const html = renderToStaticMarkup(
      <CabinetColorsAdminView colors={finishes} />
    );

    expect(html).toContain(">Cabinet Colors<");
    expect(html).toContain("Manage your inventory of cabinet finishes and metadata.");
    expect(html).toContain(">12<");
    expect(html).toContain(">1<");
    expect(html).toContain("Active");
    expect(html).toContain("Hidden");
    expect(html).not.toContain("#f5f5f7");
    expect(html).not.toContain("rounded-[18px]");
  });
});
