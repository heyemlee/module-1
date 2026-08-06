import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

type FramedColorManifestEntry = {
  name: string;
  cabinetStyle: string;
  sortOrder: number;
  swatchImageUrl: string;
  swatchImagePath: string;
  promptDescription: string;
};

const manifestPath = resolve(
  process.cwd(),
  "scripts/cabinet-colors-framed.json"
);

describe("Framed cabinet color catalog", () => {
  test("provides the six ordered Framed Shaker finishes and deployable images", () => {
    const colors = JSON.parse(
      readFileSync(manifestPath, "utf8")
    ) as FramedColorManifestEntry[];

    expect(colors.map(({ name }) => name)).toEqual([
      "Oak",
      "Grey",
      "White",
      "Blue",
      "Mocha",
      "Charcoal Gray"
    ]);
    expect(colors.map(({ sortOrder }) => sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);

    for (const color of colors) {
      expect(color.cabinetStyle).toBe("AMERICAN_FRAMED");
      expect(color.promptDescription.trim()).not.toBe("");
      expect(color.swatchImageUrl).toMatch(/^\/cabinet-colors\/framed\/.+\.jpg$/);
      expect(color.swatchImagePath).toBe(
        `public/${color.swatchImageUrl.slice(1)}`
      );
      expect(existsSync(resolve(process.cwd(), color.swatchImagePath))).toBe(true);
    }
  });
});
