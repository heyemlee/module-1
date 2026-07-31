import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "../round2-state";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import {
  buildDesignIntentQuestions,
  groupDesignIntentQuestions
} from "../model/design-intent";
import type { Round2PrototypeState } from "../round2-types";
import { DesignIntentWorkspace } from "./design-intent-workspace";

function intentState(): Round2PrototypeState {
  const locked = reduceRound2Prototype(createRound2PrototypeState("SALES"), {
    type: "ADOPT_BASIS",
    reference: ROUND1_REFERENCE_FIXTURE,
    version: 1
  });
  return {
    ...locked,
    task: "INTENT",
    measurementStatus: "SUBMITTED",
    measurements: {
      ...locked.measurements,
      "room.ceiling": 108 * 16
    }
  };
}

function groupsOf(state: Round2PrototypeState) {
  return groupDesignIntentQuestions(
    buildDesignIntentQuestions(state.model, state.measurements)
  );
}

function counter(done: number, total: number) {
  return `${String(done).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

describe("DesignIntentWorkspace", () => {
  test("reads as one measurement-style rail: single column, section headings", () => {
    const state = intentState();
    const groups = groupsOf(state);

    const html = renderToStaticMarkup(
      <DesignIntentWorkspace state={state} dispatch={() => {}} />
    );

    // Same shell as field measurement: fixed rail beside the plan.
    expect(html).toContain("md:grid-cols-[380px_minmax(0,1fr)]");
    expect(html).toContain("DESIGN INTENT");
    expect(html).toContain("Settle the choices");
    expect(html).toContain("FROM v1");
    expect(html).toContain(counter(0, groups.length));

    // Questions are grouped by class, each heading printed once.
    expect(html).toContain("CORNERS");
    expect(html).toContain("UPPER CABINETS");
    expect(html).toContain("SINK ZONE");
    expect(html.match(/>CORNERS</g)).toHaveLength(1);

    // Every question is present and expanded, none folded away.
    expect(html).toContain("Corner A–B strategy");
    expect(html).toContain("Corner A–C upper cabinets");
    expect(html).toContain("Run upper cabinets to 108″ ceiling?");
    expect(html).toContain("Trash pullout near the sink");
    expect(html).toContain("Range hood form");
    expect(html).toContain("CORNER CABINET");
    expect(html).toContain("BLIND CABINET");
    expect(html).toContain("Lazy Susan");
    expect(html).toContain("Pull-Out Shelves");
    expect(html).toContain("UPPER HEIGHT");
    expect(html).toContain("FLAT MOULDING");
    expect(html).not.toContain("aria-expanded");
  });

  test("selecting is not confirming: each row carries its own explicit action", () => {
    const base = intentState();
    const groups = groupsOf(base);
    const hood = groups.find((group) => group.kind === "hood-style");

    const edited: Round2PrototypeState = {
      ...base,
      designIntent: {
        answers: { ...base.designIntent.answers, "hood.style": "chimney" },
        confirmedKeys: []
      }
    };

    const html = renderToStaticMarkup(
      <DesignIntentWorkspace state={edited} dispatch={() => {}} />
    );

    expect(html).toContain("UNCONFIRMED");
    expect(html).toContain("KEEP DEFAULT");
    expect(html).toContain(">CONFIRM<");
    // Moving an answer confirms nothing, so nothing has been counted yet.
    expect(html).toContain(counter(0, groups.length));

    const confirmed: Round2PrototypeState = {
      ...edited,
      designIntent: {
        ...edited.designIntent,
        confirmedKeys: [hood?.id ?? "hood.style"]
      }
    };

    const settled = renderToStaticMarkup(
      <DesignIntentWorkspace state={confirmed} dispatch={() => {}} />
    );

    expect(settled).toContain("CHIMNEY");
    expect(settled).toContain("REOPEN");
    expect(settled).toContain(counter(1, groups.length));
  });

  test("relabels the moulding options when the run goes to the ceiling", () => {
    const base = intentState();
    const toCeiling: Round2PrototypeState = {
      ...base,
      designIntent: {
        ...base.designIntent,
        answers: {
          ...base.designIntent.answers,
          "uppers.termination": "ceiling"
        }
      }
    };

    const html = renderToStaticMarkup(
      <DesignIntentWorkspace state={toCeiling} dispatch={() => {}} />
    );

    expect(html).toContain("FINISH");
    expect(html).toContain("Flush to ceiling");
    expect(html).toContain("Scribe");
    expect(html).toContain("Flat moulding 3″");
    expect(html).not.toContain("FLAT MOULDING");
  });

  test("never gates generation on confirmation", () => {
    const base = intentState();
    const groups = groupsOf(base);

    const pending = renderToStaticMarkup(
      <DesignIntentWorkspace state={base} dispatch={() => {}} />
    );

    expect(pending).toContain("CONFIRMATION REQUIRED");
    expect(pending).toContain("CONFIRM ALL");
    expect(pending).toContain("AS SHOWN");
    expect(pending).toContain("Generate design proposal");
    // The CTA is live with every question still open.
    expect(pending).not.toContain('disabled=""');

    const allConfirmed: Round2PrototypeState = {
      ...base,
      designIntent: {
        ...base.designIntent,
        confirmedKeys: groups.flatMap((group) =>
          group.questions.map((question) => question.key)
        )
      }
    };

    const settled = renderToStaticMarkup(
      <DesignIntentWorkspace state={allConfirmed} dispatch={() => {}} />
    );

    expect(settled).toContain("ALL DESIGN INTENT CONFIRMED");
    expect(settled).not.toContain("CONFIRM ALL");
    expect(settled).not.toContain("KEEP DEFAULT");
    expect(settled).toContain(counter(groups.length, groups.length));
  });
});
