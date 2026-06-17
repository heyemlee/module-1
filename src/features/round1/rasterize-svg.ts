"use client";

/**
 * Rasterizes an on-screen SVG element to a base64-encoded PNG (no `data:`
 * prefix). Browser-only.
 *
 * Used to turn the deterministic floor plan SVG into a reference image for the
 * customer concept rendering. The rasterized image is a NON-AUTHORITATIVE
 * spatial reference only; the authoritative data stays in the frozen snapshot.
 */
export async function rasterizeSvgElement(
  svg: SVGSVGElement,
  options: { scale?: number; background?: string } = {}
): Promise<string> {
  const scale = options.scale ?? 2;
  const background = options.background ?? "#ffffff";

  const viewBox = svg.viewBox.baseVal;
  const width = viewBox && viewBox.width ? viewBox.width : svg.clientWidth || 760;
  const height =
    viewBox && viewBox.height ? viewBox.height : svg.clientHeight || 560;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable");
    }
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl.split(",")[1] ?? "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Failed to load SVG for rasterization"));
    image.src = src;
  });
}
