import sharp from "sharp";
import { describe, expect, test } from "vitest";
import {
  normalizeRenderingImageBuffer,
  TARGET_RENDERING_HEIGHT,
  TARGET_RENDERING_WIDTH
} from "./rendering-image-normalization";

describe("normalizeRenderingImageBuffer", () => {
  test("outputs a 1536 by 1024 PNG even when the source aspect ratio differs", async () => {
    const source = await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: "#d9b382"
      }
    })
      .png()
      .toBuffer();

    const normalized = await normalizeRenderingImageBuffer(source);
    const metadata = await sharp(normalized).metadata();

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(TARGET_RENDERING_WIDTH);
    expect(metadata.height).toBe(TARGET_RENDERING_HEIGHT);
  });
});
