"use client";

import { rasterizeSvgElement } from "./rasterize-svg";

export async function rasterizeRenderingReferences(
  svgs: Array<SVGSVGElement | null | undefined>,
  rasterize: (svg: SVGSVGElement) => Promise<string> = rasterizeSvgElement
): Promise<string[]> {
  const references: string[] = [];

  for (const svg of svgs) {
    if (!svg) {
      continue;
    }

    references.push(await rasterize(svg));
  }

  return references;
}
