import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createRound2PrototypeState } from "../round2-state";
import { DecisionRail } from "./decision-rail";

describe("DecisionRail", () => {
  test("keeps source measurements locked and offers a remeasure request", () => {
    const html = renderToStaticMarkup(
      <DecisionRail
        state={createRound2PrototypeState("DESIGNER")}
        dispatch={() => {}}
      />
    );

    expect(html).toContain("MEASUREMENTS LOCKED");
    expect(html).toContain("Request remeasure");
    expect(html).toContain("Resolve decision");
    expect(html).toContain("a-03");
  });
});
