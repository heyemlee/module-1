import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { DownloadButton } from "./download-button";

describe("DownloadButton", () => {
  test("renders an accessible Studio icon action", () => {
    const html = renderToStaticMarkup(
      <DownloadButton href="/image" fileName="rendering.png" />
    );

    expect(html).toContain('aria-label="Download rendering"');
    expect(html).toContain("Download");
    expect(html).not.toContain("dl-Btn");

    const source = readFileSync(
      "src/features/platform/download-button.tsx",
      "utf8"
    );
    expect(source).toContain("DownloadIcon");
    expect(source).not.toContain("<svg");
  });
});
