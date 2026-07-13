import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { ProjectDetail } from "./project-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} })
}));

const projectFixture = {
  id: "p1",
  companyId: "c1",
  customerId: "customer-1",
  customerName: "Elena Park",
  projectName: "Elm Street Kitchen",
  status: "INTAKE" as const,
  createdByUserId: "u1",
  assignedDesignerId: null,
  updatedAt: "2026-06-24T12:00:00.000Z"
};

describe("ProjectDetail", () => {
  test("renders real workflow progress and a recommended action", () => {
    const html = renderToStaticMarkup(
      <ProjectDetail
        project={projectFixture}
        progress={{
          hasRound1State: true,
          hasSnapshot: true,
          latestRendering: null,
          basis: null
        }}
      />
    );

    expect(html).toContain("Elm Street Kitchen");
    expect(html).toContain("Elena Park");
    expect(html).toContain("design basis");
    expect(html).toContain("Generate rendering");
    expect(html).toContain('href="/projects/p1/round1"');
    expect(html).toContain('href="/projects/p1/round2"');
  });

  test("does not retain the decorative plan glyph or retired serif", () => {
    const source = readFileSync(
      "src/features/platform/project-detail.tsx",
      "utf8"
    );

    expect(source).not.toContain("function PlanGlyph");
    expect(source).not.toContain("font-playfair");
  });

  test("uses the latest real rendering when available", () => {
    const html = renderToStaticMarkup(
      <ProjectDetail
        project={projectFixture}
        progress={{
          hasRound1State: true,
          hasSnapshot: true,
          latestRendering: {
            id: "r1",
            createdAt: "2026-06-24T12:00:00.000Z"
          },
          basis: null
        }}
      />
    );

    expect(html).toContain(
      "/api/projects/p1/round1/renderings/r1/image?px=1536x1024"
    );
    expect(html).toContain("Confirm proposal");
  });

  test("treats a locked basis as the technical-design stage", () => {
    const html = renderToStaticMarkup(
      <ProjectDetail
        project={projectFixture}
        progress={{
          hasRound1State: true,
          hasSnapshot: true,
          latestRendering: {
            id: "r1",
            createdAt: "2026-06-24T12:00:00.000Z"
          },
          basis: { version: 2, lockedAt: "2026-07-08T10:00:00.000Z" }
        }}
      />
    );

    expect(html).toContain("BASIS v2");
    expect(html).toContain("Open technical design");
    expect(html).toContain("IN PROGRESS");
  });
});
