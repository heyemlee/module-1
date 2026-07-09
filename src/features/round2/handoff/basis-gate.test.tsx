import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BasisGate } from "./basis-gate";

describe("BasisGate", () => {
  test("sends the user to the proposal page when renderings exist", () => {
    const html = renderToStaticMarkup(
      <BasisGate confirmHref="/projects/p1/renderings" hasRenderings />
    );

    expect(html).toContain("No design basis locked");
    expect(html).toContain("Open proposal &amp; confirm");
    expect(html).toContain('href="/projects/p1/renderings"');
    expect(html).toContain("Lock it as the design basis");
  });

  test("sends the user back to concept when nothing is confirmable yet", () => {
    const html = renderToStaticMarkup(
      <BasisGate confirmHref="/projects/p1/round1" hasRenderings={false} />
    );

    expect(html).toContain("Open concept phase");
    expect(html).toContain('href="/projects/p1/round1"');
    expect(html).toContain("Complete the concept phase");
  });
});
