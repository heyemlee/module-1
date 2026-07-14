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
  test("renders a checklist with locked-source note and remeasure actions", () => {
    const html = renderToStaticMarkup(
      <DecisionRail
        state={submittedState()}
        dispatch={() => {}}
      />
    );

    expect(html).toContain("locked to Sales");
    expect(html).toContain("Request remeasure");
    expect(html).toContain("Resolve decision");
    expect(html).toContain("CHECKLIST");
    expect(html).toContain("Confirmation required");
    expect(html).toContain("Default “Lazy Susan” was applied");
    expect(html).toContain("TO CONFIRM");
  });

  test("does not embed a per-cabinet editor: the drawing owns segment edits", () => {
    const html = renderToStaticMarkup(
      <DecisionRail
        state={submittedState()}
        dispatch={() => {}}
      />
    );

    expect(html).not.toContain("CONSTRAINED ADJUSTMENT");
    expect(html).not.toContain("SELECTED OBJECT");
    expect(html).not.toContain("WALL BALANCE");
    expect(html).toContain("Tap any cabinet on the drawing");
  });

  test("offers one-click resolutions on an unfillable-gap card", () => {
    const state = submittedState();
    const withGap: Round2PrototypeState = {
      ...state,
      model: state.model
        ? {
            ...state.model,
            decisionItems: [
              {
                id: "decision-a-base-2-gap-below-filler-minimum",
                objectId: "a-base-2-gap",
                wallId: "A",
                severity: "blocking",
                title: "Wall A gap below filler minimum",
                body: "2″ cannot be filled with the approved 3″-6″ filler range."
              }
            ]
          }
        : null
    };
    const html = renderToStaticMarkup(
      <DecisionRail state={withGap} dispatch={() => {}} />
    );

    expect(html).toContain("Fill with filler strips");
    expect(html).toContain("Confirm as open space");
  });

  test("shows the all-clear card when every decision is resolved", () => {
    const state = submittedState();
    const cleared: Round2PrototypeState = {
      ...state,
      proposalStatus: "READY",
      model: state.model ? { ...state.model, decisionItems: [] } : null
    };
    const html = renderToStaticMarkup(
      <DecisionRail state={cleared} dispatch={() => {}} />
    );

    expect(html).toContain("ALL CHECKS PASSED");
    expect(html).toContain("READY TO DRAW");
  });
});

function submittedState(): Round2PrototypeState {
  const locked = reduceRound2Prototype(createRound2PrototypeState("DESIGNER"), {
    type: "ADOPT_BASIS",
    reference: ROUND1_REFERENCE_FIXTURE,
    version: 1
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
