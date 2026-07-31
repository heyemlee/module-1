import { describe, expect, test } from "vitest";
import type { FloorPlan, Wall } from "@/features/round1/floorplan/plan-geometry";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { deriveWallsFromRound1 } from "./derive-walls";
import type { Round2Model } from "./round2-model";
import {
  buildDesignIntentQuestions,
  buildIntentConfirmationDecisions,
  confirmDesignIntentAnswers,
  draftDesignIntentAnswer,
  groupDesignIntentQuestions,
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

  test("groups corner cabinet styles separately from blind cabinet hardware", () => {
    const model = deriveWallsFromRound1(
      planFor("LEFT_L_SHAPE", ["TOP", "LEFT"])
    );
    const question = buildDesignIntentQuestions(model, {}).find(
      (item) => item.kind === "corner-strategy"
    );

    expect(question?.options).toEqual([
      {
        value: "lazySusan",
        label: "Lazy Susan",
        group: "cornerCabinet"
      },
      {
        value: "diagonalCorner",
        label: "Diagonal Corner",
        group: "cornerCabinet"
      },
      { value: "leMans", label: "LeMans", group: "cornerCabinet" },
      { value: "blindBase", label: "None", group: "blindCabinet" },
      {
        value: "magicCorner",
        label: "Magic Corner",
        group: "blindCabinet"
      },
      {
        value: "blindCornerPullOut",
        label: "Blind Corner Pull-Out",
        group: "blindCabinet"
      },
      {
        value: "cornerPullOutShelves",
        label: "Pull-Out Shelves",
        group: "blindCabinet"
      }
    ]);
    expect(question?.defaultValue).toBe("lazySusan");
  });

  test("omits the removed sink, tall, front-balance, and hardware questions", () => {
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
    const questions = buildDesignIntentQuestions(withSinkUnderWindow, {});

    expect(questions.map((question) => question.key)).not.toEqual(
      expect.arrayContaining([
        "sink-window.A.alignment",
        "tall.location",
        "fronts.balance",
        "hardware.style"
      ])
    );
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

  test("asks about dishwasher placement only when Round 1 parked it far from the sink", () => {
    const modelFor = (dishwasherRatio: number): Round2Model => ({
      ceilingHeightSixteenths: 96 * 16,
      walls: [
        {
          id: "A",
          label: "A",
          sourceWall: "TOP",
          lengthSixteenths: 200 * 16,
          fixedPoints: [
            {
              id: "top-appliance-sink",
              type: "appliance",
              symbol: "sink",
              label: "Sink",
              sourceWall: "TOP",
              order: 1,
              positionRatio: 0.5
            },
            {
              id: "top-appliance-dishwasher",
              type: "appliance",
              symbol: "dishwasher",
              label: "DW",
              sourceWall: "TOP",
              order: 2,
              positionRatio: dishwasherRatio
            }
          ],
          segments: [],
          notes: []
        }
      ],
      decisionItems: []
    });

    const farQuestions = buildDesignIntentQuestions(modelFor(0.1), {}).filter(
      (question) => question.kind === "dishwasher-placement"
    );
    expect(farQuestions).toHaveLength(1);
    expect(farQuestions[0]).toMatchObject({
      key: "dishwasher.top-appliance-dishwasher.placement",
      defaultValue: "dockToSink",
      objectId: "top-appliance-dishwasher"
    });
    expect(
      buildDesignIntentQuestions(modelFor(0.4), {}).filter(
        (question) => question.kind === "dishwasher-placement"
      )
    ).toHaveLength(0);
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
    const groups = groupDesignIntentQuestions(
      buildDesignIntentQuestions(model, {})
    );
    const first = groups[0];
    const initial = initializeDesignIntent(model);
    const confirmed = setDesignIntentAnswer(
      initial,
      first.id,
      first.questions[0].options[1]?.value ?? first.questions[0].defaultValue
    );
    const decisions = buildIntentConfirmationDecisions(model, confirmed, {});

    // One item per unconfirmed group, so the count the stage promises is the
    // count the proposal shows.
    expect(decisions).toHaveLength(groups.length - 1);
    expect(decisions.some((decision) => decision.id.includes(first.id))).toBe(
      false
    );
    expect(decisions[0]?.title).toContain("Confirmation required");
  });

  test("reports a merged group as one outstanding item", () => {
    const model = deriveWallsFromRound1(
      planFor("LEFT_L_SHAPE", ["TOP", "LEFT"])
    );
    const intent = initializeDesignIntent(model);

    const upperItems = () =>
      buildIntentConfirmationDecisions(model, intent, {}).filter((decision) =>
        decision.id.startsWith("decision-intent-uppers.")
      );
    expect(upperItems()).toHaveLength(1);
    expect(upperItems()[0]?.body).toContain("Standard height · 3″");

    // Confirming only the termination half leaves the single item standing.
    const half = confirmDesignIntentAnswers(intent, ["uppers.termination"]);
    expect(
      buildIntentConfirmationDecisions(model, half, {}).filter((decision) =>
        decision.id.startsWith("decision-intent-uppers.")
      )
    ).toHaveLength(1);

    const whole = confirmDesignIntentAnswers(half, ["uppers.moulding"]);
    expect(
      buildIntentConfirmationDecisions(model, whole, {}).filter((decision) =>
        decision.id.startsWith("decision-intent-uppers.")
      )
    ).toHaveLength(0);
  });

  test("groups the moulding follow-up into the upper-height row", () => {
    const model = deriveWallsFromRound1(
      planFor("LEFT_L_SHAPE", ["TOP", "LEFT"])
    );
    const questions = buildDesignIntentQuestions(model, {});
    const groups = groupDesignIntentQuestions(questions);

    // One row per question, minus the moulding question folded into its lead.
    expect(groups).toHaveLength(questions.length - 1);
    expect(
      groups.some((group) => group.kind === "flat-moulding")
    ).toBe(false);

    const upper = groups.find((group) => group.kind === "upper-termination");
    expect(upper?.id).toBe("uppers.termination");
    expect(upper?.questions.map((question) => question.key)).toEqual([
      "uppers.termination",
      "uppers.moulding"
    ]);

    // Every question still reaches exactly one row, so nothing can be
    // confirmed-by-omission.
    expect(groups.flatMap((group) => group.questions)).toHaveLength(
      questions.length
    );
  });

  test("keeps a moulding question that has no upper-height lead", () => {
    const model = deriveWallsFromRound1(
      planFor("LEFT_L_SHAPE", ["TOP", "LEFT"])
    );
    const moulding = buildDesignIntentQuestions(model, {}).filter(
      (question) => question.kind === "flat-moulding"
    );
    const groups = groupDesignIntentQuestions(moulding);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.questions).toEqual(moulding);
  });

  test("drafting an answer leaves it unconfirmed and reopens a settled one", () => {
    const model = deriveWallsFromRound1(
      planFor("LEFT_L_SHAPE", ["TOP", "LEFT"])
    );
    const confirmed = setDesignIntentAnswer(
      initializeDesignIntent(model),
      "hood.style",
      "chimney"
    );
    expect(confirmed.confirmedKeys).toContain("hood.style");

    const drafted = draftDesignIntentAnswer(
      confirmed,
      "hood.style",
      "underCabinet"
    );

    expect(drafted.answers["hood.style"]).toBe("underCabinet");
    expect(drafted.confirmedKeys).not.toContain("hood.style");
    expect(
      buildIntentConfirmationDecisions(model, drafted, {}).some((decision) =>
        decision.id.includes("hood.style")
      )
    ).toBe(true);
  });

  test("confirming changes no answers and is idempotent", () => {
    const model = deriveWallsFromRound1(
      planFor("LEFT_L_SHAPE", ["TOP", "LEFT"])
    );
    const initial = initializeDesignIntent(model);
    const confirmed = confirmDesignIntentAnswers(initial, [
      "hood.style",
      "trash.location"
    ]);

    expect(confirmed.answers).toEqual(initial.answers);
    expect(confirmed.confirmedKeys).toEqual(["hood.style", "trash.location"]);
    expect(
      buildIntentConfirmationDecisions(model, confirmed, {}).some((decision) =>
        decision.id.includes("hood.style")
      )
    ).toBe(false);

    // Re-confirming is a no-op, so a bulk "confirm all" cannot duplicate keys.
    expect(confirmDesignIntentAnswers(confirmed, ["hood.style"])).toBe(
      confirmed
    );
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
