import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ROUND2_MEASUREMENT_FIXTURE } from "../round2-fixtures";
import { MeasuredPlan } from "./measured-plan";

describe("MeasuredPlan", () => {
  test("labels the authoritative dimensions and active wall", () => {
    const html = renderToStaticMarkup(
      <MeasuredPlan
        measurements={ROUND2_MEASUREMENT_FIXTURE}
        selectedWall="A"
        selectedObjectId="wall-a"
        onSelectWall={() => {}}
      />
    );

    expect(html).toContain('aria-label="Measured kitchen plan"');
    expect(html).toContain('data-wall="A"');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain("12′ 0″");
    expect(html).toContain("Wall A");
    expect(html).not.toContain("OPEN SIDE");
    expect(html).not.toContain("stroke-dasharray");
  });
});
