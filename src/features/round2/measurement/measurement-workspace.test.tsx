import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "../round2-state";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { MeasurementWorkspace } from "./measurement-workspace";

describe("MeasurementWorkspace design intent", () => {
  test("renders topology-derived questions after the measurement fields", () => {
    const locked = reduceRound2Prototype(createRound2PrototypeState("SALES"), {
      type: "LOCK_REFERENCE",
      reference: ROUND1_REFERENCE_FIXTURE
    });
    const state = {
      ...locked,
      measurements: {
        ...locked.measurements,
        "room.ceiling": 108 * 16
      }
    };

    const html = renderToStaticMarkup(
      <MeasurementWorkspace state={state} dispatch={() => {}} />
    );

    expect(html).toContain("DESIGN INTENT");
    expect(html).toContain("Corner A–B strategy");
    expect(html).toContain("Corner A–C strategy");
    expect(html).toContain("Run upper cabinets to 108″ ceiling?");
    expect(html).toContain("Lazy Susan");
    expect(html).toContain("Finger pull");
    expect(html).toContain("DEFAULT · CONFIRM");
    expect(html).toContain("Defaults do not block submission");
  });
});
