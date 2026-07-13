import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { RenderingsView } from "./renderings-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} })
}));

const projectFixture = {
  id: "p1",
  customerName: "Elena Park",
  projectName: "Elm Street Kitchen"
};

const renderingFixture = {
  id: "r1",
  round1SnapshotId: "snap-1",
  size: "1536x1024",
  createdAt: "2026-06-24T12:00:00.000Z",
  confirmationCount: 0,
  basedOnRenderingPreferences: {
    cabinetStyle: "EUROPEAN_FRAMELESS",
    doorColorId: "oak"
  }
};

const basisFixture = {
  id: "basis-1",
  projectId: "p1",
  version: 1,
  renderingId: "r1",
  round1SnapshotId: "snap-1",
  cabinetStyle: "EUROPEAN_FRAMELESS" as const,
  doorColorId: "oak",
  lockedByUserId: "u1",
  lockedAt: "2026-07-08T10:00:00.000Z"
};

describe("RenderingsView", () => {
  test("renders real images, a layout window, and a lock affordance", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[renderingFixture]}
        colors={[{ id: "oak", name: "Natural Oak" }]}
        basis={null}
      />
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Proposal &amp; confirm");
    expect(html).toContain("Layout 1");
    expect(html).toContain("Natural Oak");
    expect(html).not.toContain("European Frameless");
    expect(html).toContain("No design basis yet");
    expect(html).toContain('class="flex items-center gap-3"');
    expect(html).not.toContain("Lock the rendering the customer confirmed");
    expect(html).not.toContain("That packages its layout snapshot");
    expect(html).toContain("Lock basis");
    expect(html).not.toContain("Open technical design");
    // Each rendering image is wrapped in a click-to-zoom trigger.
    expect(html).toContain("cursor-zoom-in");
    expect(html).toContain("Enlarge layout 1 rendering");
  });

  test("collapses same-layout finishes into one window with a finish counter", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[
          renderingFixture,
          {
            ...renderingFixture,
            id: "r2",
            createdAt: "2026-06-20T12:00:00.000Z",
            basedOnRenderingPreferences: {
              cabinetStyle: "EUROPEAN_FRAMELESS",
              doorColorId: "walnut"
            }
          }
        ]}
        colors={[
          { id: "oak", name: "Natural Oak" },
          { id: "walnut", name: "Black Walnut" }
        ]}
        basis={null}
      />
    );

    // One window for the shared layout, paging through both finishes.
    expect(html).toContain("Layout 1");
    expect(html).not.toContain("Layout 2");
    expect(html).toContain("FINISH 1/2");
    // Only the selected (newest) finish's colour shows; the other is behind the carousel.
    expect(html).toContain("Natural Oak");
    expect(html).not.toContain("Black Walnut");
  });

  test("marks the locked rendering as the basis instead of offering a lock", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[renderingFixture]}
        colors={[{ id: "oak", name: "Natural Oak" }]}
        basis={basisFixture}
      />
    );

    expect(html).toContain("Design basis v1 locked");
    expect(html).toContain("DESIGN BASIS v1");
    expect(html).not.toContain("Lock basis");
    expect(html).toContain("Open technical design");
    expect(html).toContain('href="/projects/p1/round2"');
  });

  test("offers a relock on a different layout once a basis exists", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[
          renderingFixture,
          {
            ...renderingFixture,
            id: "r2",
            round1SnapshotId: "snap-2",
            confirmationCount: 2
          }
        ]}
        colors={[{ id: "oak", name: "Natural Oak" }]}
        basis={basisFixture}
      />
    );

    // The basis layout shows its badge; the other layout is a separate window
    // that offers a relock.
    expect(html).toContain("DESIGN BASIS v1");
    expect(html).toContain("Layout 2");
    expect(html).toContain("Relock basis");
    expect(html).not.toContain("OPEN CONFIRMATION");
    expect(html).not.toContain("2 OPEN");
  });

  test("renders one functional empty-state action", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[]}
        colors={[]}
        basis={null}
      />
    );

    expect(html).toContain("No renderings yet");
    expect(html).toContain("Open concept");
    expect(html).toContain('href="/projects/p1/round1"');
  });
});
