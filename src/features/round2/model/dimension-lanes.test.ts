import { describe, expect, test } from "vitest";
import { assignDimensionLanes } from "./dimension-lanes";

describe("dimension label lanes", () => {
  test("keeps wide segments on the default lane", () => {
    expect(assignDimensionLanes([100, 80, 60], 34)).toEqual([0, 0, 0]);
  });

  test("staggers adjacent narrow segments onto alternating lanes", () => {
    expect(assignDimensionLanes([100, 20, 18, 100, 12], 34)).toEqual([
      0, 1, 2, 0, 1
    ]);
  });
});
