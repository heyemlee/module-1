import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  LockBasisButton,
  canConfirmLock,
  lockActionLabel
} from "./design-basis-lock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} })
}));

describe("design basis lock", () => {
  test("keeps locking available unless a request is in flight", () => {
    expect(canConfirmLock({ submitting: false })).toBe(true);
    expect(canConfirmLock({ submitting: true })).toBe(false);
  });

  test("labels the first lock and subsequent relocks by basis version", () => {
    expect(lockActionLabel(1)).toBe("Lock basis");
    expect(lockActionLabel(3)).toBe("Relock basis");
  });

  test("renders a lock trigger for the first basis and a relock afterwards", () => {
    const first = renderToStaticMarkup(
      <LockBasisButton
        projectId="p1"
        renderingId="r1"
        currentBasis={null}
      />
    );
    expect(first).toContain("Lock basis");
    expect(first).not.toContain("European Frameless");
    expect(first).not.toContain("confirmation");

    const relock = renderToStaticMarkup(
      <LockBasisButton
        projectId="p1"
        renderingId="r2"
        currentBasis={{
          version: 1,
          renderingId: "r1",
          lockedAt: "2026-07-08T10:00:00.000Z"
        }}
      />
    );
    expect(relock).toContain("Relock basis");
  });
});
