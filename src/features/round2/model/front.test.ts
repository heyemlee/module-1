import { describe, expect, test } from "vitest";
import { CABINET_STANDARDS } from "./cabinet-standards";
import type { Round2DesignIntent } from "./design-intent";
import { describeFront, resolveSegmentFront } from "./front";
import type { WallSegment } from "./round2-model";

describe("Round 2 cabinet fronts", () => {
  test("derives door count from the shared door rule", () => {
    expect(resolveSegmentFront(cabinet({ widthSixteenths: 18 * 16 }))).toMatchObject({
      doorCount: 1,
      drawerStack: []
    });
    expect(
      resolveSegmentFront(
        cabinet({
          widthSixteenths:
            CABINET_STANDARDS.base.doorRule.doubleDoorMinSixteenths
        })
      )
    ).toMatchObject({ doorCount: 2 });
  });

  test("maps the autofill functional tags to drawer and trash fronts", () => {
    expect(
      resolveSegmentFront(cabinet({ label: "DB24", widthSixteenths: 24 * 16 }))
    ).toMatchObject({ doorCount: 0, drawerStack: [1, 1, 1] });
    expect(
      resolveSegmentFront(cabinet({ label: "WB18", widthSixteenths: 18 * 16 }))
    ).toMatchObject({ doorCount: 1, accessories: ["trashPullout"] });
  });

  test("tags a lazy Susan corner cabinet", () => {
    expect(
      resolveSegmentFront(
        cabinet({
          label: "LS36",
          cabinetKind: "corner",
          widthSixteenths: 36 * 16
        })
      )
    ).toMatchObject({ accessories: ["lazySusan"] });
  });

  test("describes corner hardware accessories", () => {
    expect(
      describeFront(
        resolveSegmentFront(
          cabinet({
            label: "BB45",
            cabinetKind: "corner",
            widthSixteenths: 45 * 16,
            front: { accessories: ["magicCorner"] }
          })
        )
      )
    ).toBe("2 doors + Magic Corner");
  });

  test("consumes the hardware and drawer-forward intent defaults", () => {
    const intent: Round2DesignIntent = {
      answers: {
        "hardware.style": "fingerPull",
        "fronts.balance": "drawerForward"
      },
      confirmedKeys: []
    };
    expect(
      resolveSegmentFront(cabinet({ widthSixteenths: 30 * 16 }), intent)
    ).toMatchObject({
      hardware: "fingerPull",
      doorCount: 0,
      drawerStack: [1, 1, 1]
    });
  });

  test("front stores exceptions only and wins over the defaults", () => {
    const segment = cabinet({
      widthSixteenths: 30 * 16,
      front: { doorCount: 1, accessories: ["spicePullout"] }
    });
    expect(resolveSegmentFront(segment)).toMatchObject({
      doorCount: 1,
      accessories: ["spicePullout"],
      hardware: "handle"
    });
  });

  test("only cabinet faces and the sink base resolve a front", () => {
    expect(
      resolveSegmentFront(
        cabinet({ kind: "appliance", cabinetKind: "sink", label: "SB36" })
      )
    ).not.toBeNull();
    expect(
      resolveSegmentFront(cabinet({ kind: "appliance", label: "DW24" }))
    ).toBeNull();
    expect(resolveSegmentFront(cabinet({ kind: "filler", label: "F3" }))).toBeNull();
    expect(resolveSegmentFront(cabinet({ kind: "gap", label: "gap" }))).toBeNull();
  });

  test("describes the resolved front for the schedule", () => {
    expect(
      describeFront(resolveSegmentFront(cabinet({ widthSixteenths: 30 * 16 })))
    ).toBe("2 doors");
    expect(
      describeFront(
        resolveSegmentFront(cabinet({ label: "WB18", widthSixteenths: 18 * 16 }))
      )
    ).toBe("1 door + trash pullout");
    expect(describeFront(null)).toBe("—");
  });
});

function cabinet(overrides: Partial<WallSegment>): WallSegment {
  return {
    id: "a-base-1-cabinet",
    wallId: "A",
    tier: "base",
    kind: "cabinet",
    widthSixteenths: 30 * 16,
    label: "B30",
    cabinetKind: "base",
    ...overrides
  };
}
