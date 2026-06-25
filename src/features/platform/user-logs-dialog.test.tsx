import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Dialog } from "@/components/ui/dialog";
import { UsageLogContent } from "./user-logs-dialog";

describe("UserLogsDialog", () => {
  test("renders accessible loading content", () => {
    const html = renderToStaticMarkup(
      <Dialog>
        <UsageLogContent
          userName="Sales"
          stats={null}
          error={null}
        />
      </Dialog>
    );

    expect(html).toContain("Usage for Sales");
    expect(html).toContain("Rendering API calls by date.");
    expect(html).toContain("Loading usage");
    expect(html).not.toContain("<svg xmlns=");
    expect(html).not.toContain("animate-spin");
  });

  test("uses the shared Radix dialog primitives", () => {
    const source = readFileSync(
      new URL("./user-logs-dialog.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("<Dialog ");
    expect(source).toContain("<DialogContent");
    expect(source).toContain("<DialogTitle");
    expect(source).toContain("<DialogDescription");
    expect(source).toContain("<DialogClose");
    expect(source).toContain('aria-label="Close usage dialog"');
  });
});
