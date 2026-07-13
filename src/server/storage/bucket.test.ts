import { describe, expect, it, vi } from "vitest";
import {
  buildObjectKey,
  createBucketStorage,
  createBucketStorageFromEnv
} from "./bucket";

describe("bucket storage", () => {
  it("builds stable object keys from path segments", () => {
    expect(buildObjectKey("renderings", "project-1", "rendering-1.webp")).toBe(
      "renderings/project-1/rendering-1.webp"
    );
  });

  it("returns null when bucket configuration is incomplete", () => {
    expect(createBucketStorageFromEnv({ BUCKET: "bucket" })).toBeNull();
  });

  it("uploads objects with the configured bucket and content type", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = createBucketStorage({
      bucket: "assets",
      client: { send }
    });

    await storage.uploadObject("renderings/project-1/image.webp", Buffer.from("image"), "image/webp");

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: "assets",
      Key: "renderings/project-1/image.webp",
      Body: Buffer.from("image"),
      ContentType: "image/webp"
    });
  });

  it("converts downloaded object bodies to buffers", async () => {
    const send = vi.fn().mockResolvedValue({
      Body: new Uint8Array(Buffer.from("image")),
      ContentType: "image/webp"
    });
    const storage = createBucketStorage({
      bucket: "assets",
      client: { send }
    });

    await expect(storage.getObject("renderings/project-1/image.webp")).resolves.toEqual({
      body: Buffer.from("image"),
      contentType: "image/webp"
    });
  });
});
