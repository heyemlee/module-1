import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RenderingsView } from "./renderings-view";

const projectFixture = {
  id: "p1",
  customerName: "Elena Park",
  projectName: "Elm Street Kitchen"
};

const renderingFixture = {
  id: "r1",
  size: "1536x1024",
  createdAt: "2026-06-24T12:00:00.000Z",
  basedOnRenderingPreferences: {
    cabinetStyle: "EUROPEAN_FRAMELESS",
    doorColorId: "oak"
  }
};

describe("RenderingsView", () => {
  test("renders real images, latest state, and separate metadata lines", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[renderingFixture]}
        colors={[{ id: "oak", name: "Natural Oak" }]}
      />
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Renderings");
    expect(html).toContain("Latest");
    expect(html).toContain("Natural Oak");
    expect(html).toContain("European Frameless");
    expect(html).not.toContain(" · ");
    expect(html).not.toContain("—");
    // Each rendering image is wrapped in a click-to-zoom trigger.
    expect(html).toContain("cursor-zoom-in");
    expect(html).toContain("Enlarge concept rendering");
  });

  test("renders one functional empty-state action", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[]}
        colors={[]}
      />
    );

    expect(html).toContain("No renderings yet");
    expect(html).toContain("Open Round 1");
    expect(html).toContain('href="/projects/p1/round1"');
  });
});
