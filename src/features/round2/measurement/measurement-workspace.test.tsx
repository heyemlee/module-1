import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "../round2-state";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import type { Round2PrototypeState } from "../round2-types";
import { MeasurementWorkspace } from "./measurement-workspace";

function lockedState(): Round2PrototypeState {
  const locked = reduceRound2Prototype(createRound2PrototypeState("SALES"), {
    type: "ADOPT_BASIS",
    reference: ROUND1_REFERENCE_FIXTURE,
    version: 1
  });
  return {
    ...locked,
    measurements: {
      ...locked.measurements,
      "room.ceiling": 108 * 16
    }
  };
}

describe("MeasurementWorkspace", () => {
  test("captures measurements only — design intent is its own stage", () => {
    const html = renderToStaticMarkup(
      <MeasurementWorkspace state={lockedState()} dispatch={() => {}} />
    );

    expect(html).toContain("FIELD MEASUREMENT");
    expect(html).toContain("Capture the room");
    expect(html).toContain("Finished ceiling height");
    expect(html).toContain("Wall A overall length");

    // None of the design-intent questions live here any more.
    expect(html).not.toContain("DESIGN INTENT");
    expect(html).not.toContain("Corner A–B strategy");
    expect(html).not.toContain("Run upper cabinets");
    expect(html).not.toContain("Trash pullout near the sink");
    expect(html).not.toContain("Range hood form");
    expect(html).not.toContain("Keep default");
    expect(html).not.toContain("Confirmation Required");
  });

  test("submit hands off to the design-intent stage", () => {
    const state = lockedState();

    const html = renderToStaticMarkup(
      <MeasurementWorkspace state={state} dispatch={() => {}} />
    );
    expect(html).toContain("Submit v1 → design intent");

    const submitted: Round2PrototypeState = {
      ...state,
      measurementStatus: "SUBMITTED"
    };
    const resubmit = renderToStaticMarkup(
      <MeasurementWorkspace state={submitted} dispatch={() => {}} />
    );
    expect(resubmit).toContain("Resubmit v1 → design intent");
    expect(resubmit).toContain("RESUBMIT TO REVISIT DESIGN INTENT");
  });

  test("blocks submit until every required field is captured", () => {
    const state = lockedState();
    const incomplete: Round2PrototypeState = {
      ...state,
      measurements: { ...state.measurements, "room.ceiling": null }
    };

    const html = renderToStaticMarkup(
      <MeasurementWorkspace state={incomplete} dispatch={() => {}} />
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain("REQUIRED");
  });
});
