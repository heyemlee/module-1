import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "../round2-state";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import type { Round2PrototypeState } from "../round2-types";
import { DecisionRail } from "./decision-rail";

describe("DecisionRail", () => {
  test("keeps source measurements locked and offers a remeasure request", () => {
    const html = renderToStaticMarkup(
      <DecisionRail
        state={submittedState()}
        dispatch={() => {}}
      />
    );

    expect(html).toContain("MEASUREMENTS LOCKED");
    expect(html).toContain("Request remeasure");
    expect(html).toContain("Resolve decision");
    expect(html).toContain("WALL A");
    expect(html).toContain("No filler decisions");
  });
});

function submittedState(): Round2PrototypeState {
  const locked = reduceRound2Prototype(createRound2PrototypeState("DESIGNER"), {
    type: "LOCK_REFERENCE",
    reference: ROUND1_REFERENCE_FIXTURE
  });
  const completed = {
    ...locked,
    measurements: Object.fromEntries(
      Object.keys(locked.measurements).map((key) => [
        key,
        key === "room.ceiling"
          ? 96 * 16
          : key.endsWith(".width")
            ? 36 * 16
            : key.endsWith(".offset")
              ? 42 * 16
              : 150 * 16
      ])
    )
  };
  return reduceRound2Prototype(completed, { type: "SUBMIT_MEASUREMENT" });
}
