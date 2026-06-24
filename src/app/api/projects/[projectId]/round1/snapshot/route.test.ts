import { beforeEach, describe, expect, test, vi } from "vitest";
import { PUT } from "./route";

// The snapshot PUT is a trust boundary: it must refuse any payload that tries to
// weaken the Round 1 safety invariants (sales-estimate-only, not-for-production,
// rough dimensions). If the schema ever loosens to z.boolean(), AI/clients could
// silently mark Round 1 data production-ready — so the gate earns a test.
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getProjectForUser: vi.fn(),
  saveRound1Snapshot: vi.fn()
}));

vi.mock("@/server/platform/auth-service", () => ({
  requireUser: mocks.requireUser,
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {}
}));
vi.mock("@/server/platform/project-repository", () => ({
  getProjectForUser: mocks.getProjectForUser
}));
vi.mock("@/server/platform/round1-postgres-repository", () => ({
  saveRound1Snapshot: mocks.saveRound1Snapshot
}));

const validBody = {
  schemaVersion: 1,
  generatedAt: "2026-06-17T00:00:00.000Z",
  fixedPositionsConfirmed: true,
  cabinetFillGenerated: true,
  salesEstimateOnly: true,
  notForProduction: true,
  dimensionConfidence: "ROUGH",
  preliminaryCabinets: [] // passthrough payload survives
};

function put(body: unknown) {
  return PUT(
    new Request("http://localhost/api/projects/project-1/round1/snapshot", {
      method: "PUT",
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ projectId: "project-1" }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "u1", companyId: "c1", role: "SALES" });
  mocks.getProjectForUser.mockResolvedValue({ id: "project-1" });
  mocks.saveRound1Snapshot.mockResolvedValue("snapshot-1");
});

describe("PUT /api/projects/[projectId]/round1/snapshot (safety-invariant gate)", () => {
  test("persists a valid sales-only snapshot", async () => {
    const res = await put(validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ snapshotId: "snapshot-1" });
    expect(mocks.saveRound1Snapshot).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["salesEstimateOnly=false", { ...validBody, salesEstimateOnly: false }],
    ["notForProduction=false", { ...validBody, notForProduction: false }],
    ["dimensionConfidence=EXACT", { ...validBody, dimensionConfidence: "EXACT" }]
  ])("rejects a payload that weakens %s and never persists", async (_label, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(mocks.saveRound1Snapshot).not.toHaveBeenCalled();
  });

  test("404 (no persist) when the project is not the user's", async () => {
    mocks.getProjectForUser.mockResolvedValue(null);
    const res = await put(validBody);
    expect(res.status).toBe(404);
    expect(mocks.saveRound1Snapshot).not.toHaveBeenCalled();
  });
});
