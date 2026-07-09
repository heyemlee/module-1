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
  test("renders real images, latest state, and a lock affordance per card", () => {
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
    expect(html).toContain("Latest");
    expect(html).toContain("Natural Oak");
    expect(html).toContain("European Frameless");
    expect(html).toContain("No design basis yet");
    expect(html).toContain("Lock basis");
    expect(html).not.toContain("Open technical design");
    // Each rendering image is wrapped in a click-to-zoom trigger.
    expect(html).toContain("cursor-zoom-in");
    expect(html).toContain("Enlarge concept rendering");
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

  test("offers a relock on non-basis cards once a basis exists", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[
          renderingFixture,
          { ...renderingFixture, id: "r2", confirmationCount: 2 }
        ]}
        colors={[{ id: "oak", name: "Natural Oak" }]}
        basis={basisFixture}
      />
    );

    expect(html).toContain("Relock basis");
    expect(html).toContain("2 OPEN");
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
