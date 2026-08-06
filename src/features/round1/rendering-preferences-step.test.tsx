import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "./showroom-intake-data";
import {
  nextRenderingPreferencesForStyle,
  preferencesWithoutTierColors,
  preferencesWithTierColor,
  renderingPreferenceStampForForm,
  renderingPreferenceStampMatches,
  renderingPreferencesComplete,
  renderingSwatchGroups,
  resolveRenderingColorPlan,
  stampedColorIds
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
    id: "eu-graphite",
    companyId: "company",
    cabinetStyle: "EUROPEAN_FRAMELESS",
    name: "Graphite Matte",
    colorCode: "EU-140",
    swatchImageUrl: "https://example.com/graphite.jpg",
    swatchHex: "#3b3b3d",
    hoverExampleImageUrl: null,
    promptDescription: "deep graphite matte slab cabinet doors",
    active: true,
    sortOrder: 2,
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

function formWithColors(
  doorColorId: string,
  tierColorIds?: Partial<{ BASE: string | null; WALL: string | null; TALL: string | null }>
) {
  return {
    ...createDefaultShowroomForm(),
    renderingPreferences: {
      cabinetStyle: "EUROPEAN_FRAMELESS" as const,
      doorColorId,
      tierColorIds: { BASE: null, WALL: null, TALL: null, ...tierColorIds }
    }
  };
}

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

  test("lists the active colors as a named swatch grid with an available count", () => {
    const form = createDefaultShowroomForm();
    expect(form.renderingPreferences?.doorColorId ?? null).toBeNull();

    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={form}
        colors={colors}
        onFormChange={() => {}}
      />
    );

    // Named swatches for the selected style, plus the availability count.
    expect(html).toContain("Natural Oak Matte");
    expect(html).toContain("2 AVAILABLE");
    expect(html).toContain('aria-label="Select Natural Oak Matte"');
    expect(html).toContain("object-contain");
    expect(html).not.toContain("object-cover");
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
  test("offers per-cabinet-type colors once a main color is chosen", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={formWithColors("eu-oak")}
        colors={colors}
        onFormChange={() => {}}
      />
    );

    expect(html).toContain("Different color per cabinet type");
    expect(html).toContain("OPTIONAL");
    // Collapsed by default: no target row, and the board still paints the main
    // color, so a single-color project sees exactly the old UI.
    expect(html).not.toContain("Cabinet type to color");
    expect(html).toContain('aria-label="Select Natural Oak Matte"');
  });

  test("offers per-cabinet-type colors before any main color is chosen", () => {
    const form = createDefaultShowroomForm();
    expect(form.renderingPreferences?.doorColorId ?? null).toBeNull();

    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={form}
        colors={colors}
        onFormChange={() => {}}
      />
    );

    // Reachable from the start: a designer who only wants per-type colors is
    // not forced to pick an "all cabinets" color first.
    expect(html).toContain("Different color per cabinet type");
  });

  test("opens the cabinet-type targets when overrides are already set", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={formWithColors("eu-oak", { WALL: "eu-graphite" })}
        colors={colors}
        onFormChange={() => {}}
      />
    );

    expect(html).toContain("Cabinet type to color");
    expect(html).toContain('aria-label="Color the base cabinets"');
    expect(html).toContain('aria-label="Color the wall cabinets"');
    expect(html).toContain('aria-label="Color the tall cabinets"');
    // The section's own switch already is the "all cabinets" choice, so there
    // is no competing all-cabinets target alongside the per-type ones.
    expect(html).not.toContain('aria-label="Color the main door color"');
  });

  test("keeps every finish in use marked with the cabinet types it covers", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={formWithColors("eu-oak", { WALL: "eu-graphite" })}
        colors={colors}
        onFormChange={() => {}}
      />
    );

    // Both finishes stay ticked at the same time — switching targets must not
    // read as "the other selection was lost".
    expect(html).toContain("BASE · TALL");
    expect(html).toContain("✓ WALL");
    expect(
      html.split('aria-pressed="true"').length - 1
    ).toBeGreaterThanOrEqual(2);
  });

  test("marks a single-color kitchen with one plain tick", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={formWithColors("eu-oak")}
        colors={colors}
        onFormChange={() => {}}
      />
    );

    expect(html).not.toContain("BASE · TALL");
    expect(html).not.toContain("✓ ALL");
    expect(html).not.toContain("ring-2");
  });

  test("shows one color board no matter how many cabinet types are targeted", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={formWithColors("eu-oak", { WALL: "eu-graphite" })}
        colors={colors}
        onFormChange={() => {}}
      />
    );

    // Each finish appears exactly once as a selectable swatch — the board is
    // re-aimed by the target chips, never duplicated per cabinet type.
    const swatchCount =
      html.split('aria-label="Set base cabinets to Graphite Matte"').length - 1;
    expect(swatchCount).toBe(1);
    expect(html).not.toContain('aria-label="Wall cabinets: Graphite Matte"');
  });

  test("resolves each cabinet type to its own color, falling back to the main one", () => {
    const plan = resolveRenderingColorPlan(
      colors,
      formWithColors("eu-oak", { WALL: "eu-graphite" })
    );

    expect(plan?.multiColor).toBe(true);
    expect(plan?.byTier.BASE.id).toBe("eu-oak");
    expect(plan?.byTier.TALL.id).toBe("eu-oak");
    expect(plan?.byTier.WALL.id).toBe("eu-graphite");
    expect(plan?.uniqueColors.map((color) => color.id)).toEqual([
      "eu-oak",
      "eu-graphite"
    ]);
  });

  test("treats an override repeating the main color as a single-color kitchen", () => {
    const plan = resolveRenderingColorPlan(
      colors,
      formWithColors("eu-oak", { WALL: "eu-oak", BASE: "eu-oak" })
    );

    expect(plan?.multiColor).toBe(false);
    expect(plan?.overrides).toEqual({});
  });

  test("ignores an override whose color was retired or belongs to another style", () => {
    const plan = resolveRenderingColorPlan(
      colors,
      formWithColors("eu-oak", { WALL: "us-white", TALL: "deleted-color" })
    );

    expect(plan?.multiColor).toBe(false);
    expect(plan?.byTier.WALL.id).toBe("eu-oak");
    expect(plan?.byTier.TALL.id).toBe("eu-oak");
  });

  test("sends one swatch per finish, carried by the first type that uses it", () => {
    const single = resolveRenderingColorPlan(colors, formWithColors("eu-oak"));
    expect(renderingSwatchGroups(single!).map((group) => group.role)).toEqual([
      "MATERIAL_SWATCH"
    ]);

    const plan = resolveRenderingColorPlan(
      colors,
      formWithColors("eu-oak", { TALL: "eu-graphite" })
    );
    const groups = renderingSwatchGroups(plan!);

    expect(groups.map((group) => group.role)).toEqual([
      "MATERIAL_SWATCH_BASE",
      "MATERIAL_SWATCH_TALL"
    ]);
    expect(groups[0].tiers).toEqual(["BASE", "WALL"]);
    expect(groups[1].tiers).toEqual(["TALL"]);
  });

  test("omits swatches for colors with no swatch image", () => {
    const withoutSwatch = colors.map((color) =>
      color.id === "eu-graphite" ? { ...color, swatchImageUrl: null } : color
    );
    const plan = resolveRenderingColorPlan(
      withoutSwatch,
      formWithColors("eu-oak", { WALL: "eu-graphite" })
    );

    expect(renderingSwatchGroups(plan!).map((group) => group.role)).toEqual([
      "MATERIAL_SWATCH_BASE"
    ]);
  });

  test("marks a rendering stale when only a cabinet type was recolored", () => {
    const form = formWithColors("eu-oak");
    const stamp = renderingPreferenceStampForForm(form, colors);

    expect(renderingPreferenceStampMatches(stamp, form, colors)).toBe(true);
    expect(
      renderingPreferenceStampMatches(
        stamp,
        formWithColors("eu-oak", { WALL: "eu-graphite" }),
        colors
      )
    ).toBe(false);
  });

  test("reads a rendering from before per-type colors as having no overrides", () => {
    const legacyStamp = {
      cabinetStyle: "EUROPEAN_FRAMELESS" as const,
      doorColorId: "eu-oak",
      colorUpdatedAt: "2026-06-19T00:00:00.000Z"
    };

    // Still current while nothing is overridden — adding the field alone must
    // not age existing renderings.
    expect(
      renderingPreferenceStampMatches(legacyStamp, formWithColors("eu-oak"), colors)
    ).toBe(true);

    // But recoloring one cabinet type does make it stale. A missing tier stamp
    // means "generated with no overrides", never "matches anything" — otherwise
    // the regenerate that the recolor just earned stays blocked.
    expect(
      renderingPreferenceStampMatches(
        legacyStamp,
        formWithColors("eu-oak", { BASE: "eu-graphite" }),
        colors
      )
    ).toBe(false);
  });

  test("keeps a rendering current when a cabinet type is set to the main color", () => {
    const form = formWithColors("eu-oak");
    const stamp = renderingPreferenceStampForForm(form, colors);

    // Explicitly picking the main color for one type changes nothing about the
    // image, so it must not demand a regenerate.
    expect(
      renderingPreferenceStampMatches(
        stamp,
        formWithColors("eu-oak", { BASE: "eu-oak" }),
        colors
      )
    ).toBe(true);
  });

  test("style switching drops per-cabinet-type colors from the other style", () => {
    const next = nextRenderingPreferencesForStyle(
      formWithColors("eu-oak", { WALL: "eu-graphite" }),
      colors,
      "AMERICAN_FRAMED"
    );

    expect(next.doorColorId).toBeNull();
    expect(next.tierColorIds).toEqual({ BASE: null, WALL: null, TALL: null });
  });

  test("lets the only picked cabinet type define the whole kitchen", () => {
    // Nothing picked yet: coloring one type colors everything, so the
    // preferences are immediately complete and lockable.
    const empty = createDefaultShowroomForm();
    const seeded = preferencesWithTierColor(empty, "BASE", colors[0]);

    expect(seeded.doorColorId).toBe("eu-oak");
    expect(
      renderingPreferencesComplete(colors, {
        ...empty,
        renderingPreferences: seeded
      })
    ).toBe(true);

    // Still the only picked type, so re-picking moves the whole kitchen with it
    // rather than leaving the other types on the previous color.
    const repicked = preferencesWithTierColor(
      { ...empty, renderingPreferences: seeded },
      "BASE",
      colors[1]
    );
    expect(repicked.doorColorId).toBe("eu-graphite");

    // Picking a second type stops it defining the others.
    const diverged = preferencesWithTierColor(
      { ...empty, renderingPreferences: repicked },
      "WALL",
      colors[0]
    );
    expect(diverged.doorColorId).toBe("eu-graphite");
    expect(diverged.tierColorIds).toEqual({
      BASE: "eu-graphite",
      WALL: "eu-oak",
      TALL: null
    });

    const plan = resolveRenderingColorPlan(colors, {
      ...empty,
      renderingPreferences: diverged
    });
    expect(plan?.byTier.BASE.id).toBe("eu-graphite");
    expect(plan?.byTier.WALL.id).toBe("eu-oak");
    // The type never picked follows the one that defined the kitchen.
    expect(plan?.byTier.TALL.id).toBe("eu-graphite");
  });

  test("turning per-type colors off drops every override", () => {
    const form = formWithColors("eu-oak", { BASE: "eu-oak" });
    const withWall = preferencesWithTierColor(form, "WALL", colors[1]);

    expect(withWall.tierColorIds).toEqual({
      BASE: "eu-oak",
      WALL: "eu-graphite",
      TALL: null
    });

    const cleared = preferencesWithoutTierColors({
      ...form,
      renderingPreferences: withWall
    });
    expect(cleared.tierColorIds).toEqual({
      BASE: null,
      WALL: null,
      TALL: null
    });
    // Back to one color everywhere — the per-type picks stop applying.
    expect(cleared.doorColorId).toBe("eu-oak");
  });

  test("labels a rendering with every finish it used", () => {
    const plan = resolveRenderingColorPlan(
      colors,
      formWithColors("eu-oak", { WALL: "eu-graphite" })
    );
    const stamp = renderingPreferenceStampForForm(
      formWithColors("eu-oak", { WALL: "eu-graphite" }),
      colors
    );

    expect(plan?.multiColor).toBe(true);
    expect(stampedColorIds(stamp)).toEqual(["eu-oak", "eu-graphite"]);
    expect(stampedColorIds(null, "eu-oak")).toEqual(["eu-oak"]);
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
