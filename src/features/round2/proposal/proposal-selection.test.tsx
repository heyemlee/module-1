import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ROUND2_CABINET_FIXTURE } from "../round2-fixtures";
import { DesignPlan } from "./design-plan";
import { WallElevation } from "./wall-elevation";

describe("Round 2 proposal selection", () => {
  test("marks the same cabinet selected in plan and elevation", () => {
    const plan = renderToStaticMarkup(
      <DesignPlan
        cabinets={ROUND2_CABINET_FIXTURE}
        selectedObjectId="a-03"
        onSelect={() => {}}
      />
    );
    const elevation = renderToStaticMarkup(
      <WallElevation
        wall="A"
        cabinets={ROUND2_CABINET_FIXTURE}
        selectedObjectId="a-03"
        onSelect={() => {}}
      />
    );

    expect(plan).toContain('data-cabinet-id="a-03"');
    expect(plan).toContain('data-selected="true"');
    expect(elevation).toContain('data-cabinet-id="a-03"');
    expect(elevation).toContain('data-selected="true"');
  });
});
