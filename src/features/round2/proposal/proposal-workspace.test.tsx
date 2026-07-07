import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "../round2-state";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import type { Round2PrototypeState } from "../round2-types";
import { ProposalWorkspace } from "./proposal-workspace";

describe("ProposalWorkspace", () => {
  test("keeps the top view below the elevation at the same surface size", () => {
    const html = renderToStaticMarkup(
      <ProposalWorkspace state={submittedState()} dispatch={() => {}} />
    );

    const elevationIndex = html.indexOf('data-testid="proposal-elevation-panel"');
    const planIndex = html.indexOf('data-testid="proposal-plan-panel"');

    expect(elevationIndex).toBeGreaterThan(-1);
    expect(planIndex).toBeGreaterThan(elevationIndex);
    expect(html).toContain(
      'data-testid="proposal-elevation-panel" class="h-[440px] min-h-[440px] w-full shrink-0"'
    );
    expect(html).toContain(
      'data-testid="proposal-plan-panel" class="h-[440px] min-h-[440px] w-full shrink-0"'
    );
    expect(html).not.toContain("max-w-[420px]");
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
