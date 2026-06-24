import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "./showroom-intake-data";
import {
  nextRenderingPreferencesForStyle,
  renderingPreferenceStampForForm,
  renderingPreferenceStampMatches
} from "./rendering-preferences";
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
      />
    );

    expect(html).toContain("Natural Oak Matte");
    expect(html).not.toContain("Painted White");
  });

  test("marks a confirmed cabinet color as locked", () => {
    const form = {
      ...createDefaultShowroomForm(),
      renderingPreferences: {
        cabinetStyle: "EUROPEAN_FRAMELESS" as const,
        doorColorId: "eu-oak"
      }
    };

    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={form}
        colors={colors}
        onFormChange={() => {}}
      />
    );

    expect(html).toContain("Natural Oak Matte");
  });

  test("shows an admin setup message when no active colors exist", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={createDefaultShowroomForm()}
        colors={[]}
        onFormChange={() => {}}
      />
    );

    expect(html).toContain("Ask an Admin to configure cabinet colors");
  });

  test("compares rendering preference stamps against the current form", () => {
    const form = {
      ...createDefaultShowroomForm(),
      renderingPreferences: {
        cabinetStyle: "EUROPEAN_FRAMELESS" as const,
        doorColorId: "eu-oak"
      }
    };
    const stamp = renderingPreferenceStampForForm(form);

    expect(renderingPreferenceStampMatches(stamp, form)).toBe(true);
    expect(
      renderingPreferenceStampMatches(stamp, {
        ...form,
        renderingPreferences: {
          cabinetStyle: "EUROPEAN_FRAMELESS",
          doorColorId: "eu-walnut"
        }
      })
    ).toBe(false);
    expect(
      renderingPreferenceStampMatches(stamp, {
        ...form,
        renderingPreferences: {
          cabinetStyle: "AMERICAN_FRAMED",
          doorColorId: "eu-oak"
        }
      })
    ).toBe(false);
    expect(renderingPreferenceStampMatches(null, form)).toBe(false);
  });

  test("style switching keeps only known compatible colors", () => {
    const form = {
      ...createDefaultShowroomForm(),
      renderingPreferences: {
        cabinetStyle: "EUROPEAN_FRAMELESS" as const,
        doorColorId: "eu-oak"
      }
    };

    expect(
      nextRenderingPreferencesForStyle(form, colors, "EUROPEAN_FRAMELESS")
        .doorColorId
    ).toBe("eu-oak");
    expect(
      nextRenderingPreferencesForStyle(form, colors, "AMERICAN_FRAMED")
        .doorColorId
    ).toBeNull();
    expect(
      nextRenderingPreferencesForStyle(
        {
          ...form,
          renderingPreferences: {
            cabinetStyle: "EUROPEAN_FRAMELESS",
            doorColorId: "deleted-color"
          }
        },
        colors,
        "EUROPEAN_FRAMELESS"
      ).doorColorId
    ).toBeNull();
  });
  test("uses a contextual retry action when cabinet colors fail", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={createDefaultShowroomForm()}
        colors={[]}
        colorsError
        onRetryLoadColors={() => {}}
        onFormChange={() => {}}
      />
    );

    expect(html).toContain("Cabinet colors could not be loaded");
    expect(html).toContain("Try again");
    expect(html).toContain('role="alert"');
  });
});
