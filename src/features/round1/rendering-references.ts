"use client";

import { rasterizeSvgElement } from "./rasterize-svg";

export type RenderingReferenceRole =
  | "PERSPECTIVE_STRUCTURE"
  | "TOP_DOWN_PLAN"
  | "WALL_ELEVATIONS"
  | "MATERIAL_SWATCH";

export type RenderingReference = {
  role: RenderingReferenceRole;
  imageBase64: string;
};

export async function rasterizeRenderingReferences(
  inputs: Array<{ role: RenderingReferenceRole; svg: SVGSVGElement | null | undefined }>,
  rasterize: (svg: SVGSVGElement) => Promise<string> = rasterizeSvgElement
): Promise<RenderingReference[]> {
  const references: RenderingReference[] = [];

  for (const { role, svg } of inputs) {
    if (!svg) {
      continue;
    }

    references.push({
      role,
      imageBase64: await rasterize(svg)
    });
  }

  return references;
}

/**
 * Rasterizes an image source (e.g. a cabinet color swatch data URL) to a
 * square base64-encoded PNG (no `data:` prefix). Browser-only.
 *
 * Used to send the selected door color's swatch to the image model as a
 * MATERIAL reference alongside the deterministic floor plan, so the rendering
 * matches the actual color/finish rather than relying on the text prompt alone.
 */
export async function rasterizeImageSourceToPngBase64(
  src: string,
  size = 512
): Promise<string> {
  const image = await loadImageElement(src);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  // Cover-fit so the swatch fills the square without distortion.
  const ratio = Math.max(size / image.width, size / image.height);
  const w = image.width * ratio;
  const h = image.height * ratio;
  ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load swatch image"));
    image.src = src;
  });
}
