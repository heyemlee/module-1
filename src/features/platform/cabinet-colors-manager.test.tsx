import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CabinetColorsManager, toDraft, buildDrafts, isDirty } from "./cabinet-colors-manager";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} })
}));

const baseColor: CabinetColor = {
  id: "c-1",
  companyId: "company-1",
  cabinetStyle: "EUROPEAN_FRAMELESS",
  name: "Original Name",
  colorCode: "ORIGINAL",
  swatchImageUrl: "https://example.com/swatch.jpg",
  swatchHex: null,
  hoverExampleImageUrl: "https://example.com/hover.jpg",
  promptDescription: "Original description",
  active: true,
  sortOrder: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("CabinetColorsManager draft logic", () => {
  test("a fresh draft is not dirty", () => {
    const draft = toDraft(baseColor);
    expect(isDirty(baseColor, draft)).toBe(false);
  });

  test("changing name is dirty", () => {
    const draft = toDraft(baseColor);
    draft.name = "New Name";
    expect(isDirty(baseColor, draft)).toBe(true);
  });

  test("changing style is dirty", () => {
    const draft = toDraft(baseColor);
    draft.cabinetStyle = "AMERICAN_FRAMED";
    expect(isDirty(baseColor, draft)).toBe(true);
  });

  test("changing active is dirty", () => {
    const draft = toDraft(baseColor);
    draft.active = false;
    expect(isDirty(baseColor, draft)).toBe(true);
  });

  test("selecting either image is dirty", () => {
    let draft = toDraft(baseColor);
    draft.swatchData = "data:image/jpeg;base64,...";
    expect(isDirty(baseColor, draft)).toBe(true);

    draft = toDraft(baseColor);
    draft.hoverData = "data:image/jpeg;base64,...";
    expect(isDirty(baseColor, draft)).toBe(true);
  });

  test("existing server previews do not count as newly selected images", () => {
    const draft = toDraft(baseColor);
    expect(draft.swatchPreview).toBe("https://example.com/swatch.jpg");
    expect(draft.swatchData).toBeUndefined();
    expect(isDirty(baseColor, draft)).toBe(false);
  });

  test("buildDrafts handles arrays", () => {
    const drafts = buildDrafts([baseColor]);
    expect(drafts["c-1"]).toBeDefined();
    expect(drafts["c-1"].name).toBe("Original Name");
  });
});

describe("CabinetColorsManager UI", () => {
  test("markup structure matches the handoff design", () => {
    const html = renderToStaticMarkup(
      <CabinetColorsManager colors={[baseColor]} />
    );
    expect(html).toContain("Door color library");
    expect(html).toContain("Save all");
    expect(html).toContain("Add color"); // "+ Add color" trigger
    expect(html).toContain(">ON<"); // active ON/OFF toggle (baseColor is active)
    expect(html).toContain('alt="Original Name swatch"'); // Image alt includes the color name
    expect(html).not.toContain("#f5f5f7"); // No legacy hardcoded hex classes
    expect(html).not.toContain("bg-[#");
  });
});
