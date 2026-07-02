import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { Round1Handoff } from "./round1-handoff";

describe("Round1Handoff", () => {
  test("shows the complete Round 1 source before unlocking Round 2", () => {
    const html = renderToStaticMarkup(
      <Round1Handoff
        reference={ROUND1_REFERENCE_FIXTURE}
        role="SALES"
        onLock={() => {}}
        nextReferenceVersion={1}
      />
    );

    expect(html).toContain("Round 1 handoff");
    expect(html).toContain("U-shape");
    expect(html).toContain("European frameless");
    expect(html).toContain("Natural White Oak");
    expect(html).toContain("Fridge");
    expect(html).toContain("Lock for Round 2");
    expect(html).not.toContain("Field Measurement");
  });

  test("explains that relocking creates a new reference version", () => {
    const html = renderToStaticMarkup(
      <Round1Handoff
        reference={ROUND1_REFERENCE_FIXTURE}
        role="DESIGNER"
        onLock={() => {}}
        nextReferenceVersion={2}
      />
    );

    expect(html).toContain("Creates Reference v2");
    expect(html).toContain("Relock for Round 2");
  });
});
