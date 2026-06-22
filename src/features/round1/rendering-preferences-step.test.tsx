import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "./showroom-intake-data";
import { RenderingPreferencesStep } from "./rendering-preferences-step";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

const colors: CabinetColor[] = [
  {
    id: "eu-oak",
    companyId: "company",
    cabinetStyle: "EUROPEAN_FRAMELESS",
    name: "Natural Oak Matte",
    colorCode: "EU-101",
    swatchImageUrl: "https://example.com/oak.jpg",
    swatchHex: "#d8c8ad",
    hoverExampleImageUrl: "https://example.com/oak-kitchen.jpg",
    promptDescription: "warm natural oak matte slab cabinet doors",
    active: true,
    sortOrder: 1,
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z"
  },
  {
    id: "us-white",
    companyId: "company",
    cabinetStyle: "AMERICAN_FRAMED",
    name: "Painted White",
    colorCode: "US-201",
    swatchImageUrl: "https://example.com/white.jpg",
    swatchHex: "#f4f1e8",
    hoverExampleImageUrl: null,
    promptDescription: "painted soft white framed cabinet doors",
    active: true,
    sortOrder: 1,
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z"
  }
];

describe("RenderingPreferencesStep", () => {
  test("shows large color board for the selected style only", () => {
    const form = createDefaultShowroomForm();
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={form}
        colors={colors}
        onFormChange={() => {}}
        onGenerateCabinetFill={() => {}}
        onGenerateRendering={() => {}}
        canGenerateCabinetFill
        canGenerateRendering={false}
        renderingBusy={false}
      />
    );

    expect(html).toContain("Natural Oak Matte");
    expect(html).not.toContain("Painted White");
    expect(html).toContain("Confirm Color");
  });

  test("shows an admin setup message when no active colors exist", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={createDefaultShowroomForm()}
        colors={[]}
        onFormChange={() => {}}
        onGenerateCabinetFill={() => {}}
        onGenerateRendering={() => {}}
        canGenerateCabinetFill={false}
        canGenerateRendering={false}
        renderingBusy={false}
      />
    );

    expect(html).toContain("Ask an Admin to configure cabinet colors");
  });
});
