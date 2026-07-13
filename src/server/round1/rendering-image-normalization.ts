import sharp from "sharp";

export const TARGET_RENDERING_WIDTH = 1536;
export const TARGET_RENDERING_HEIGHT = 1024;
export const TARGET_RENDERING_SIZE =
  `${TARGET_RENDERING_WIDTH}x${TARGET_RENDERING_HEIGHT}` as const;

export async function normalizeRenderingImageBuffer(
  image: Buffer,
  {
    width = TARGET_RENDERING_WIDTH,
    height = TARGET_RENDERING_HEIGHT
  }: { width?: number; height?: number } = {}
) {
  return sharp(image)
    .rotate()
    .resize(width, height, {
      fit: "cover",
      position: "center"
    })
    .png()
    .toBuffer();
}

export async function normalizeRenderingImageBase64(
  imageBase64: string,
  options?: { width?: number; height?: number }
) {
  const image = Buffer.from(imageBase64, "base64");
  const normalized = await normalizeRenderingImageBuffer(image, options);
  return normalized.toString("base64");
}
