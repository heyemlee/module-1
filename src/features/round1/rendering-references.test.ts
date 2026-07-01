import { describe, expect, test, vi } from "vitest";
import { rasterizeRenderingReferences } from "./rendering-references";

describe("rasterizeRenderingReferences", () => {
  test("rasterizes the top-down reference when it is the only available SVG", async () => {
    const topDown = {} as SVGSVGElement;
    const rasterize = vi.fn(async () => "top-down-png");

    const result = await rasterizeRenderingReferences(
      [
        { role: "TOP_DOWN_PLAN", svg: topDown },
        { role: "PERSPECTIVE_STRUCTURE", svg: null }
      ],
      rasterize
    );

    expect(result).toEqual([{ role: "TOP_DOWN_PLAN", imageBase64: "top-down-png" }]);
    expect(rasterize).toHaveBeenCalledTimes(1);
  });

  test("rasterizes top-down and perspective references in order", async () => {
    const topDown = { id: "top" } as unknown as SVGSVGElement;
    const perspective = { id: "perspective" } as unknown as SVGSVGElement;
    const rasterize = vi
      .fn<(svg: SVGSVGElement) => Promise<string>>()
      .mockResolvedValueOnce("top-down-png")
      .mockResolvedValueOnce("perspective-png");

    const result = await rasterizeRenderingReferences(
      [
        { role: "TOP_DOWN_PLAN", svg: topDown },
        { role: "PERSPECTIVE_STRUCTURE", svg: perspective }
      ],
      rasterize
    );

    expect(result).toEqual([
      { role: "TOP_DOWN_PLAN", imageBase64: "top-down-png" },
      { role: "PERSPECTIVE_STRUCTURE", imageBase64: "perspective-png" }
    ]);
    expect(rasterize).toHaveBeenNthCalledWith(1, topDown);
    expect(rasterize).toHaveBeenNthCalledWith(2, perspective);
  });
});
