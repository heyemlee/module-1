import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "./showroom-intake-data";
import { buildRound1Snapshot } from "./snapshot";
import { normalizeRound1Form } from "@/domain/round1";
import {
  RenderingPreferencesLockControl,
  canGenerateConceptRendering,
  renderingMatchesCurrentInputs,
  renderingPreferencesStateAfterChange
} from "./showroom-intake-app";

function renderLock({
  preferencesLocked,
  canLock
}: {
  preferencesLocked: boolean;
  canLock: boolean;
}) {
  return renderToStaticMarkup(
    <RenderingPreferencesLockControl
      preferencesLocked={preferencesLocked}
      canLock={canLock}
      onLock={() => {}}
      onUnlock={() => {}}
    />
  );
}

describe("RenderingPreferencesLockControl", () => {
  test("disables locking and explains what is missing when no valid color is selected", () => {
    const html = renderLock({ preferencesLocked: false, canLock: false });

    expect(html).toContain('disabled=""');
    expect(html).toContain("Select a cabinet color before locking.");
  });

  test("allows locking when a valid color is selected", () => {
    const html = renderLock({ preferencesLocked: false, canLock: true });

    expect(html).not.toContain('disabled=""');
    expect(html).toContain('title="Lock preferences"');
  });

  test("offers manual unlock after preferences are locked", () => {
    const html = renderLock({ preferencesLocked: true, canLock: true });

    expect(html).not.toContain('disabled=""');
    expect(html).toContain("Click to unlock");
  });

  test("automatically unlocks whenever rendering preferences change", () => {
    const nextForm = {
      ...createDefaultShowroomForm(),
      renderingPreferences: {
        cabinetStyle: "AMERICAN_FRAMED" as const,
        doorColorId: "us-white"
      }
    };

    expect(renderingPreferencesStateAfterChange(nextForm)).toEqual({
      form: nextForm,
      preferencesLocked: false
    });
  });

  test("requires the current preferences to be locked before generating", () => {
    expect(
      canGenerateConceptRendering({
        persistState: "saved",
        preferencesComplete: true,
        preferencesLocked: false,
        hasCurrentRendering: false
      })
    ).toBe(false);

    expect(
      canGenerateConceptRendering({
        persistState: "saved",
        preferencesComplete: true,
        preferencesLocked: true,
        hasCurrentRendering: false
      })
    ).toBe(true);
  });

  test("blocks generation when the same locked inputs already have a rendering", () => {
    expect(
      canGenerateConceptRendering({
        persistState: "saved",
        preferencesComplete: true,
        preferencesLocked: true,
        hasCurrentRendering: true
      })
    ).toBe(false);
  });

  test("matches renderings by snapshot and rendering preference stamp", () => {
    const form = {
      ...createDefaultShowroomForm(),
      renderingPreferences: {
        cabinetStyle: "EUROPEAN_FRAMELESS" as const,
        doorColorId: "color-1"
      }
    };
    const normalized = normalizeRound1Form(form);
    const snapshot = buildRound1Snapshot({
      showroomForm: form,
      normalized: normalized.normalized,
      positionOverrides: {},
      preliminaryCabinets: {
        cabinets: [],
        confirmationItems: [],
        estimatedFillerWidth: 0,
        salesEstimateOnly: true,
        notForProduction: true
      },
      confirmationItems: normalized.confirmationItems,
      readiness: normalized.readiness,
      now: () => new Date("2026-06-30T12:00:00.000Z")
    });
    const colors = [
      {
        id: "color-1",
        companyId: "company-1",
        name: "White",
        colorCode: "WHITE",
        cabinetStyle: "EUROPEAN_FRAMELESS" as const,
        promptDescription: "white slab",
        active: true,
        sortOrder: 1,
        swatchHex: "#ffffff",
        swatchImageUrl: null,
        hoverExampleImageUrl: null,
        createdAt: "2026-06-30T00:00:00.000Z",
        updatedAt: "2026-06-30T01:00:00.000Z"
      }
    ];

    expect(
      renderingMatchesCurrentInputs({
        rendering: {
          basedOnSnapshotGeneratedAt: snapshot.generatedAt,
          basedOnRenderingPreferences: {
            cabinetStyle: "EUROPEAN_FRAMELESS",
            doorColorId: "color-1",
            colorUpdatedAt: "2026-06-30T01:00:00.000Z"
          }
        },
        snapshot,
        form,
        colors
      })
    ).toBe(true);

    expect(
      renderingMatchesCurrentInputs({
        rendering: {
          basedOnSnapshotGeneratedAt: "2026-06-30T12:01:00.000Z",
          basedOnRenderingPreferences: {
            cabinetStyle: "EUROPEAN_FRAMELESS",
            doorColorId: "color-1",
            colorUpdatedAt: "2026-06-30T01:00:00.000Z"
          }
        },
        snapshot,
        form,
        colors
      })
    ).toBe(false);
  });
});
