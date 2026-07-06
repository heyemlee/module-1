import { describe, expect, test } from "vitest";
import type { FloorPlan, Wall } from "@/features/round1/floorplan/plan-geometry";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { deriveWallsFromRound1 } from "./derive-walls";
import {
  buildDesignIntentQuestions,
  buildIntentConfirmationDecisions,
  initializeDesignIntent,
  setDesignIntentAnswer
} from "./design-intent";

describe("Round 2 design intent", () => {
  test.each([
    ["GALLEY", ["TOP", "BOTTOM"], 0],
    ["LEFT_L_SHAPE", ["TOP", "LEFT"], 1],
    ["U_SHAPE", ["TOP", "RIGHT", "LEFT"], 2]
  ])("derives %s corner questions from topology", (layout, walls, count) => {
    const model = deriveWallsFromRound1(planFor(layout, walls as Wall[]));
    const questions = buildDesignIntentQuestions(model, {});

    expect(
      questions.filter((question) => question.kind === "corner-strategy")
    ).toHaveLength(count);
  });

  test("asks about sink-to-window alignment only when both share a wall", () => {
    const base = planFor("LEFT_L_SHAPE", ["TOP", "LEFT"]);
    const withSinkUnderWindow = deriveWallsFromRound1({
      ...base,
      appliances: [
        {
          key: "sink",
          label: "Sink",
          symbol: "sink",
          wall: "TOP",
          x: 310,
          y: 78,
          w: 112,
          h: 44
        }
      ]
    });
    const windowWithoutSink = deriveWallsFromRound1(base);

    expect(
      buildDesignIntentQuestions(withSinkUnderWindow, {}).filter(
        (question) => question.kind === "sink-window-alignment"
      )
    ).toHaveLength(1);
    expect(
      buildDesignIntentQuestions(windowWithoutSink, {}).filter(
        (question) => question.kind === "sink-window-alignment"
      )
    ).toHaveLength(0);
  });

  test("uses measured ceiling height in the upper-cabinet prompt", () => {
    const model = deriveWallsFromRound1(
      planFor("ONE_WALL", ["TOP"])
    );
    const question = buildDesignIntentQuestions(model, {
      "room.ceiling": 108 * 16
    }).find((item) => item.key === "uppers.termination");

    expect(question?.label).toContain("108″ ceiling");
  });

  test("initializes every question with a default but leaves it unconfirmed", () => {
    const model = deriveWallsFromRound1(
      planFor("U_SHAPE", ["TOP", "RIGHT", "LEFT"])
    );
    const questions = buildDesignIntentQuestions(model, {});
    const intent = initializeDesignIntent(model);

    expect(Object.keys(intent.answers)).toHaveLength(questions.length);
    expect(intent.confirmedKeys).toEqual([]);
    for (const question of questions) {
      expect(intent.answers[question.key]).toBe(question.defaultValue);
    }
  });

  test("emits decisions only for defaults that have not been confirmed", () => {
    const model = deriveWallsFromRound1(
      planFor("LEFT_L_SHAPE", ["TOP", "LEFT"])
    );
    const questions = buildDesignIntentQuestions(model, {});
    const first = questions[0];
    const initial = initializeDesignIntent(model);
    const confirmed = setDesignIntentAnswer(
      initial,
      first.key,
      first.options[1]?.value ?? first.defaultValue
    );
    const decisions = buildIntentConfirmationDecisions(model, confirmed, {});

    expect(decisions).toHaveLength(questions.length - 1);
    expect(decisions.some((decision) => decision.id.includes(first.key))).toBe(
      false
    );
    expect(decisions[0]?.title).toContain("Confirmation required");
  });
});

function planFor(layoutPreference: string, walls: Wall[]): FloorPlan {
  return {
    ...ROUND1_REFERENCE_FIXTURE.floorPlan,
    layoutPreference,
    baseCabinets: walls.map((wall, index) => ({
      x: 100 + index * 40,
      y: 100,
      w: 40,
      h: 24,
      code: `B${index}`,
      confirmationRequired: false,
      wall
    })),
    wallCabinets: [],
    appliances: [],
    window: walls.includes("TOP")
      ? { x: 310, y: 58, w: 112, h: 8, wall: "TOP" }
      : null,
    door: null,
    markers: []
  };
}
