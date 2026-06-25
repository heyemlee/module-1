import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RouteSkeleton } from "./route-skeleton";

describe("RouteSkeleton", () => {
  test.each(["dashboard", "detail", "table", "plain", "round1"] as const)(
    "renders the %s variant in the Studio system",
    (variant) => {
      const html = renderToStaticMarkup(<RouteSkeleton variant={variant} />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("bg-studio-void");
      expect(html).toContain("studio-skeleton");
      expect(html).not.toContain("#f5f5f7");
      expect(html).not.toContain("#d2d2d7");
    }
  );
});
