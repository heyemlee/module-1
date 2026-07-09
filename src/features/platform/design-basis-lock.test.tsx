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
  test("requires acknowledging open confirmation items before locking", () => {
    expect(
      canConfirmLock({ confirmationCount: 0, acknowledged: false, submitting: false })
    ).toBe(true);
    expect(
      canConfirmLock({ confirmationCount: 2, acknowledged: false, submitting: false })
    ).toBe(false);
    expect(
      canConfirmLock({ confirmationCount: 2, acknowledged: true, submitting: false })
    ).toBe(true);
    expect(
      canConfirmLock({ confirmationCount: 0, acknowledged: true, submitting: true })
    ).toBe(false);
  });

  test("labels the first lock and subsequent relocks by basis version", () => {
    expect(lockActionLabel(1)).toBe("Lock as design basis");
    expect(lockActionLabel(3)).toBe("Relock as basis v3");
  });

  test("renders a lock trigger for the first basis and a relock afterwards", () => {
    const first = renderToStaticMarkup(
      <LockBasisButton
        projectId="p1"
        renderingId="r1"
        colorName="Natural Oak"
        styleLabel="European Frameless"
        confirmationCount={0}
        currentBasis={null}
      />
    );
    expect(first).toContain("Lock basis");

    const relock = renderToStaticMarkup(
      <LockBasisButton
        projectId="p1"
        renderingId="r2"
        colorName="Natural Oak"
        styleLabel="European Frameless"
        confirmationCount={0}
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
