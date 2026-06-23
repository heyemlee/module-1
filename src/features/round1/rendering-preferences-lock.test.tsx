import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "./showroom-intake-data";
import {
  RenderingPreferencesLockControl,
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

  test("does not offer manual unlock after preferences are locked", () => {
    const html = renderLock({ preferencesLocked: true, canLock: true });

    expect(html).toContain('disabled=""');
    expect(html).not.toContain("Unlock preferences");
    expect(html).toContain("Change the selection to unlock automatically");
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
});
