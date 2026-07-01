import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const appSource = readFileSync(
  new URL("./showroom-intake-app.tsx", import.meta.url),
  "utf8"
);
const panelSource = readFileSync(
  new URL("./showroom-intake-panels.tsx", import.meta.url),
  "utf8"
);

describe("Round 1 perspective frontend cleanup", () => {
  test("does not connect perspective UI or hidden reference generation", () => {
    expect(appSource).not.toMatch(
      /PerspectivePreview|referencePerspectiveRef|referencePerspectiveSvg|perspectiveOpen|perspectiveThumb|perspectiveLightbox/
    );
    expect(panelSource).not.toContain("Round1PerspectiveLightbox");
  });
});
