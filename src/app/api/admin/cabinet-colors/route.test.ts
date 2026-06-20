import { describe, expect, test } from "vitest";
import * as route from "./route";
import { parseCabinetColorRequest } from "./validation";

describe("admin cabinet color route helpers", () => {
  test("keeps route module exports compatible with Next route handlers", () => {
    expect(Object.keys(route).sort()).toEqual(["GET", "POST"]);
  });

  test("parses create requests", () => {
    expect(
      parseCabinetColorRequest({
        cabinetStyle: "EUROPEAN_FRAMELESS",
        name: "Natural Oak Matte",
        colorCode: "EU-101",
        swatchImageUrl: "https://example.com/oak.jpg",
        swatchHex: "#d8c8ad",
        hoverExampleImageUrl: "https://example.com/example.jpg",
        promptDescription: "warm natural oak matte slab cabinet doors",
        active: true,
        sortOrder: 1
      })
    ).toMatchObject({
      cabinetStyle: "EUROPEAN_FRAMELESS",
      name: "Natural Oak Matte",
      active: true
    });
  });

  test("requires active and sortOrder for replacement requests", () => {
    const baseRequest = {
      cabinetStyle: "EUROPEAN_FRAMELESS",
      name: "Natural Oak Matte",
      colorCode: "EU-101",
      swatchImageUrl: "https://example.com/oak.jpg",
      swatchHex: "#d8c8ad",
      hoverExampleImageUrl: "https://example.com/example.jpg",
      promptDescription: "warm natural oak matte slab cabinet doors"
    };

    expect(() => parseCabinetColorRequest({ ...baseRequest, sortOrder: 1 })).toThrow();
    expect(() => parseCabinetColorRequest({ ...baseRequest, active: true })).toThrow();
  });
});
