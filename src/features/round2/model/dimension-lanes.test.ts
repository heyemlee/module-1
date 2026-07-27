import { describe, expect, test } from "vitest";
import {
  layoutDimensionLabels,
  measureDimensionLabel,
  type DimensionLabel
} from "./dimension-lanes";

const FONT_SIZE = 11;

function boxes(
  labels: readonly DimensionLabel[],
  placements: ReturnType<typeof layoutDimensionLabels>
) {
  return placements.map((placement, index) => {
    const width = measureDimensionLabel(labels[index].text, FONT_SIZE);
    return {
      lane: placement.lane,
      left: placement.center - width / 2,
      right: placement.center + width / 2
    };
  });
}

/** Every pair sharing a lane must stay apart — no label may cover another. */
function overlaps(
  labels: readonly DimensionLabel[],
  placements: ReturnType<typeof layoutDimensionLabels>
): number {
  const laid = boxes(labels, placements);
  let count = 0;
  for (let a = 0; a < laid.length; a += 1) {
    for (let b = a + 1; b < laid.length; b += 1) {
      if (laid[a].lane !== laid[b].lane) continue;
      if (laid[a].left < laid[b].right && laid[b].left < laid[a].right) {
        count += 1;
      }
    }
  }
  return count;
}

describe("dimension label placement", () => {
  test("leaves labels on their segment midpoint when they already clear", () => {
    const labels = [
      { center: 100, text: "36″" },
      { center: 200, text: "36″" },
      { center: 300, text: "24″" }
    ];
    const placements = layoutDimensionLabels(labels, {
      fontSize: FONT_SIZE,
      bounds: [70, 570]
    });

    expect(placements.map((placement) => placement.center)).toEqual([
      100, 200, 300
    ]);
    expect(placements.every((placement) => !placement.shifted)).toBe(true);
    expect(placements.every((placement) => placement.lane === 0)).toBe(true);
  });

  test("splits a cramped pair to both sides instead of shoving one", () => {
    // Two 3/4″ fillers back to back: ~3px apart, ~30px of label each.
    const labels = [
      { center: 298, text: "3/4″" },
      { center: 301, text: "1 1/2″" }
    ];
    const placements = layoutDimensionLabels(labels, {
      fontSize: FONT_SIZE,
      bounds: [70, 570]
    });

    expect(overlaps(labels, placements)).toBe(0);
    expect(placements[0].center).toBeLessThan(298);
    expect(placements[1].center).toBeGreaterThan(301);
    expect(placements.every((placement) => placement.shifted)).toBe(true);
  });

  test("keeps a whole crowded run legible on one row", () => {
    // The 180″ wall from the proposal: two fillers wedged between wide runs.
    const labels = [
      { center: 100, text: "36″" },
      { center: 168, text: "36″" },
      { center: 187, text: "3/4″" },
      { center: 221, text: "24″" },
      { center: 256, text: "3/4″" },
      { center: 260, text: "1 1/2″" },
      { center: 296, text: "24″" }
    ];
    const placements = layoutDimensionLabels(labels, {
      fontSize: FONT_SIZE,
      bounds: [70, 570],
      maxShift: 30
    });

    expect(overlaps(labels, placements)).toBe(0);
    expect(placements.every((placement) => placement.lane === 0)).toBe(true);
  });

  test("keeps labels in reading order so leaders never cross", () => {
    const labels = [
      { center: 120, text: "3/4″" },
      { center: 126, text: "1 1/2″" },
      { center: 132, text: "3/4″" },
      { center: 138, text: "24″" }
    ];
    const placements = layoutDimensionLabels(labels, {
      fontSize: FONT_SIZE,
      bounds: [70, 570]
    });

    const sameLane = placements.filter((placement) => placement.lane === 0);
    const centers = sameLane.map((placement) => placement.center);
    expect([...centers].sort((a, b) => a - b)).toEqual(centers);
  });

  test("spills to the next row once sliding would carry a label too far", () => {
    const labels = Array.from({ length: 8 }, (_, index) => ({
      center: 300 + index * 4,
      text: "1 1/2″"
    }));
    const placements = layoutDimensionLabels(labels, {
      fontSize: FONT_SIZE,
      bounds: [70, 570],
      maxShift: 30,
      maxLanes: 2
    });

    expect(overlaps(labels, placements)).toBe(0);
    expect(placements.some((placement) => placement.lane === 1)).toBe(true);
  });

  test("holds every label inside the bounds when the row has room", () => {
    const labels = [
      { center: 72, text: "1 1/2″" },
      { center: 300, text: "36″" },
      { center: 568, text: "1 1/2″" }
    ];
    const placements = layoutDimensionLabels(labels, {
      fontSize: FONT_SIZE,
      bounds: [70, 570]
    });

    for (const box of boxes(labels, placements)) {
      expect(box.left).toBeGreaterThanOrEqual(70 - 0.01);
      expect(box.right).toBeLessThanOrEqual(570 + 0.01);
    }
  });

  test("never drops a label, however tight the row", () => {
    const labels = Array.from({ length: 30 }, (_, index) => ({
      center: 300 + index,
      text: "1 1/2″"
    }));
    const placements = layoutDimensionLabels(labels, {
      fontSize: FONT_SIZE,
      bounds: [70, 570],
      maxShift: 30,
      maxLanes: 2
    });

    expect(placements).toHaveLength(labels.length);
    expect(overlaps(labels, placements)).toBe(0);
  });
});
