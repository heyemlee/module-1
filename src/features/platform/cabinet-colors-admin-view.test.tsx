import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { CabinetColorsAdminView } from "./cabinet-colors-admin-view";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

vi.mock("./cabinet-colors-manager", () => ({
  CabinetColorsManager: () => <div data-testid="manager" />
}));

const finishes: CabinetColor[] = [
  {
    id: "c-1",
    companyId: "c1",
    cabinetStyle: "EUROPEAN_FRAMELESS",
    name: "Color 1",
    colorCode: "C1",
    swatchImageUrl: null,
    swatchHex: "#fff",
    hoverExampleImageUrl: null,
    promptDescription: "A color",
    active: true,
    sortOrder: 1,
    createdAt: "",
    updatedAt: ""
  }
];

describe("CabinetColorsAdminView", () => {
  test("renders the cabinet colors manager (handoff page lives there)", () => {
    const html = renderToStaticMarkup(
      <CabinetColorsAdminView colors={finishes} />
    );

    expect(html).toContain('data-testid="manager"');
  });
});
