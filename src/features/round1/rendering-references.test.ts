import { describe, expect, test, vi } from "vitest";
import { rasterizeRenderingReferences } from "./rendering-references";

describe("rasterizeRenderingReferences", () => {
  test("rasterizes the top-down reference when it is the only available SVG", async () => {
    const topDown = {} as SVGSVGElement;
    const rasterize = vi.fn(async () => "top-down-png");

    const result = await rasterizeRenderingReferences([topDown, null], rasterize);

    expect(result).toEqual(["top-down-png"]);
    expect(rasterize).toHaveBeenCalledTimes(1);
  });

  test("rasterizes top-down and elevation references in order", async () => {
    const topDown = { id: "top" } as unknown as SVGSVGElement;
    const elevation = { id: "elevation" } as unknown as SVGSVGElement;
    const rasterize = vi
      .fn<(svg: SVGSVGElement) => Promise<string>>()
      .mockResolvedValueOnce("top-down-png")
      .mockResolvedValueOnce("elevation-png");

    const result = await rasterizeRenderingReferences([topDown, elevation], rasterize);

    expect(result).toEqual(["top-down-png", "elevation-png"]);
    expect(rasterize).toHaveBeenNthCalledWith(1, topDown);
    expect(rasterize).toHaveBeenNthCalledWith(2, elevation);
  });
});
