import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import { buildRound1Snapshot } from "./snapshot";
import { ShowroomIntakeApp } from "./showroom-intake-app";
import { AppliancesStep, LayoutStep, OpeningsStep } from "./showroom-intake-steps";
import {
  CabinetFillSummaryPanel,
  Round1SnapshotPanel,
  RenderingControls
} from "./showroom-intake-panels";
import { shouldApplySnapshotRestore } from "./showroom-intake-app";

function buildFixtureSnapshot() {
  const form = createDefaultShowroomForm();
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildRound1Snapshot({
    showroomForm: form,
    normalized: result.normalized,
    positionOverrides: {},
    preliminaryCabinets: estimate,
    confirmationItems: [
      ...result.confirmationItems,
      ...estimate.confirmationItems
    ],
    readiness: result.readiness,
    now: () => new Date("2026-06-17T12:00:00.000Z")
  });
}

type ElementWithChildrenProps = {
  children?: ReactNode;
};

type SelectChangeEvent = {
  target: { value: string };
};

type SelectElementProps = ElementWithChildrenProps & {
  onChange: (event: SelectChangeEvent) => void;
};

function childrenOf(element: ReactElement): ReactNode {
  return (element as ReactElement<ElementWithChildrenProps>).props.children;
}

function renderFunctionElement(element: ReactElement): ReactNode {
  const Component = element.type as (props: unknown) => ReactNode;
  return Component(element.props);
}

function textFromReactNode(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textFromReactNode).join("");
  }
  if (isValidElement(node)) {
    if (typeof node.type === "function") {
      return textFromReactNode(renderFunctionElement(node));
    }
    return textFromReactNode(childrenOf(node));
  }
  return "";
}

function findFirstElementByType(
  node: ReactNode,
  type: string
): ReactElement<ElementWithChildrenProps> | null {
  if (node === null || node === undefined || typeof node === "boolean") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstElementByType(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (typeof node.type === "function") {
    return findFirstElementByType(renderFunctionElement(node), type);
  }
  if (node.type === type) {
    return node as ReactElement<ElementWithChildrenProps>;
  }
  return findFirstElementByType(childrenOf(node), type);
}

function findSelectByLabel(
  node: ReactNode,
  label: string
): ReactElement<SelectElementProps> | null {
  if (node === null || node === undefined || typeof node === "boolean") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found: ReactElement<SelectElementProps> | null =
        findSelectByLabel(child, label);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (typeof node.type === "function") {
    return findSelectByLabel(renderFunctionElement(node), label);
  }
  if (node.type === "label" && textFromReactNode(node).includes(label)) {
    return findFirstElementByType(
      node,
      "select"
    ) as ReactElement<SelectElementProps> | null;
  }
  return findSelectByLabel(childrenOf(node), label);
}

function changeSelect(
  select: ReactElement<SelectElementProps>,
  value: string
): void {
  select.props.onChange({ target: { value } });
}

describe("OpeningsStep", () => {
  test("does not render first-phase door or window width inputs", () => {
    const html = renderToStaticMarkup(
      <OpeningsStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).not.toContain("Door width if known");
    expect(html).not.toContain("Window width if known");
  });

  test("keeps window relation to wall-level positions only", () => {
    const html = renderToStaticMarkup(
      <OpeningsStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).toContain("Window approximate relation");
    expect(html).toContain("BACK_SIDE");
    expect(html).toContain("LEFT_SIDE");
    expect(html).toContain("RIGHT_SIDE");
    expect(html).toContain("FRONT_SIDE");
    expect(html).not.toContain("BEHIND_SINK");
    expect(html).not.toContain("UNDER_WINDOW");
  });
});

describe("AppliancesStep", () => {
  test("asks only rough presence and wall for cooking appliances", () => {
    const html = renderToStaticMarkup(
      <AppliancesStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).toContain("Range included?");
    expect(html).toContain("Range approximate wall");
    expect(html).toContain("Cooktop included?");
    expect(html).toContain("Wall oven included?");
    expect(html).toContain("Microwave / oven combo included?");
    expect(html).not.toContain("Range size");
    expect(html).not.toContain("Cooktop size");
    expect(html).not.toContain("Oven / microwave");
    expect(html).not.toContain("Oven / microwave position");
  });

  test("drops the approximate-wall question for cooktop, wall oven, and microwave/oven combo", () => {
    const form = createDefaultShowroomForm();
    const cooking = form.layoutSensitiveCabinets.cookingAppliances;
    const html = renderToStaticMarkup(
      <AppliancesStep
        form={{
          ...form,
          layoutSensitiveCabinets: {
            ...form.layoutSensitiveCabinets,
            cookingAppliances: {
              ...cooking,
              range: { status: "YES", relation: "BACK_SIDE" },
              cooktop: { status: "YES", relation: "UNKNOWN" },
              wallOven: { status: "YES", relation: "UNKNOWN" },
              microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
            }
          }
        }}
        setForm={() => {}}
      />
    );

    // Range still asks for an approximate wall.
    expect(html).toContain("Range approximate wall");
    // Cooktop, wall oven, and microwave/oven combo no longer do — the auto-layout places them.
    expect(html).not.toContain("Cooktop approximate wall");
    expect(html).not.toContain("Wall oven approximate wall");
    expect(html).not.toContain("Microwave / oven combo approximate wall");
  });

  test("shows oven and microwave arrangement only when wall oven or microwave is included", () => {
    const form = createDefaultShowroomForm();
    const cooking = form.layoutSensitiveCabinets.cookingAppliances;
    const hiddenHtml = renderToStaticMarkup(
      <AppliancesStep
        form={{
          ...form,
          layoutSensitiveCabinets: {
            ...form.layoutSensitiveCabinets,
            cookingAppliances: {
              ...cooking,
              wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
              microwaveOvenCombo: { status: "NO", relation: "NOT_APPLICABLE" }
            }
          }
        }}
        setForm={() => {}}
      />
    );
    const visibleHtml = renderToStaticMarkup(
      <AppliancesStep
        form={{
          ...form,
          layoutSensitiveCabinets: {
            ...form.layoutSensitiveCabinets,
            cookingAppliances: {
              ...cooking,
              wallOven: { status: "YES", relation: "UNKNOWN" },
              microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
            }
          }
        }}
        setForm={() => {}}
      />
    );

    expect(hiddenHtml).not.toContain("Oven and microwave arrangement?");
    expect(visibleHtml).toContain("Oven and microwave arrangement?");
    expect(visibleHtml).toContain("WALL_OVEN_MICROWAVE_STACK");
    expect(visibleHtml).toContain("SEPARATE_WALL_OVEN_AND_MICROWAVE");
    expect(visibleHtml).toContain("NO_MICROWAVE");
    expect(visibleHtml).toContain("NO_OVEN");
    expect(visibleHtml).toContain("UNKNOWN");
  });

  test("maps oven and microwave arrangement changes into appliance statuses", () => {
    const cases = [
      {
        configuration: "WALL_OVEN_MICROWAVE_STACK",
        wallOven: { status: "YES", relation: "UNKNOWN" },
        microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
      },
      {
        configuration: "SEPARATE_WALL_OVEN_AND_MICROWAVE",
        wallOven: { status: "YES", relation: "UNKNOWN" },
        microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
      },
      {
        configuration: "NO_MICROWAVE",
        wallOven: { status: "YES", relation: "UNKNOWN" },
        microwaveOvenCombo: { status: "NO", relation: "NOT_APPLICABLE" }
      },
      {
        configuration: "NO_OVEN",
        wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
        microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
      },
      {
        configuration: "UNKNOWN",
        wallOven: { status: "YES", relation: "LEFT_SIDE" },
        microwaveOvenCombo: { status: "NO", relation: "NOT_APPLICABLE" }
      }
    ] as const;

    for (const expected of cases) {
      const form = createDefaultShowroomForm();
      let nextForm = form;
      const select = findSelectByLabel(
        <AppliancesStep
          form={{
            ...form,
            layoutSensitiveCabinets: {
              ...form.layoutSensitiveCabinets,
              ovenMicrowave: {
                configuration: "UNKNOWN",
                relation: "NEAR_RANGE"
              },
              cookingAppliances: {
                ...form.layoutSensitiveCabinets.cookingAppliances,
                wallOven: { status: "YES", relation: "LEFT_SIDE" },
                microwaveOvenCombo: {
                  status: "NO",
                  relation: "NOT_APPLICABLE"
                }
              }
            }
          }}
          setForm={(updatedForm) => {
            nextForm = updatedForm;
          }}
        />,
        "Oven and microwave arrangement?"
      );

      expect(select).not.toBeNull();
      changeSelect(select!, expected.configuration);

      expect(
        nextForm.layoutSensitiveCabinets.ovenMicrowave
      ).toMatchObject({
        configuration: expected.configuration,
        relation: "UNKNOWN"
      });
      expect(
        nextForm.layoutSensitiveCabinets.cookingAppliances.wallOven
      ).toEqual(expected.wallOven);
      expect(
        nextForm.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo
      ).toEqual(expected.microwaveOvenCombo);
    }
  });

  test("resets stale oven and microwave arrangement when microwave status changes directly", () => {
    const form = createDefaultShowroomForm();
    let nextForm = form;
    const select = findSelectByLabel(
      <AppliancesStep
        form={{
          ...form,
          layoutSensitiveCabinets: {
            ...form.layoutSensitiveCabinets,
            ovenMicrowave: {
              configuration: "NO_MICROWAVE",
              relation: "UNKNOWN"
            },
            cookingAppliances: {
              ...form.layoutSensitiveCabinets.cookingAppliances,
              wallOven: { status: "YES", relation: "UNKNOWN" },
              microwaveOvenCombo: {
                status: "NO",
                relation: "NOT_APPLICABLE"
              }
            }
          }
        }}
        setForm={(updatedForm) => {
          nextForm = updatedForm;
        }}
      />,
      "Microwave / oven combo included?"
    );

    expect(select).not.toBeNull();
    changeSelect(select!, "YES");

    expect(nextForm.layoutSensitiveCabinets.ovenMicrowave).toEqual({
      configuration: "UNKNOWN",
      relation: "UNKNOWN"
    });
    expect(
      nextForm.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo
    ).toEqual({ status: "YES", relation: "UNKNOWN" });
  });

  test("resets arrangement to unknown when direct status changes leave no wall oven or microwave", () => {
    const form = createDefaultShowroomForm();
    let nextForm = form;
    const select = findSelectByLabel(
      <AppliancesStep
        form={{
          ...form,
          layoutSensitiveCabinets: {
            ...form.layoutSensitiveCabinets,
            ovenMicrowave: {
              configuration: "NO_OVEN",
              relation: "UNKNOWN"
            },
            cookingAppliances: {
              ...form.layoutSensitiveCabinets.cookingAppliances,
              wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
              microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
            }
          }
        }}
        setForm={(updatedForm) => {
          nextForm = updatedForm;
        }}
      />,
      "Microwave / oven combo included?"
    );

    expect(select).not.toBeNull();
    changeSelect(select!, "NO");

    expect(nextForm.layoutSensitiveCabinets.ovenMicrowave).toEqual({
      configuration: "UNKNOWN",
      relation: "UNKNOWN"
    });
    expect(
      nextForm.layoutSensitiveCabinets.cookingAppliances.wallOven
    ).toEqual({ status: "NO", relation: "NOT_APPLICABLE" });
    expect(
      nextForm.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo
    ).toEqual({ status: "NO", relation: "NOT_APPLICABLE" });
  });
});

describe("LayoutStep", () => {
  test("offers left/right L-shapes first and moves island to a separate three-state field", () => {
    const html = renderToStaticMarkup(
      <LayoutStep
        form={createDefaultShowroomForm()}
        setForm={() => {}}
        setPositionOverrides={() => {}}
      />
    );

    const leftIndex = html.indexOf("LEFT_L_SHAPE");
    const rightIndex = html.indexOf("RIGHT_L_SHAPE");
    const uIndex = html.indexOf("U_SHAPE");
    const oneWallIndex = html.indexOf("ONE_WALL");

    expect(leftIndex).toBeGreaterThan(-1);
    expect(rightIndex).toBeGreaterThan(leftIndex);
    expect(uIndex).toBeGreaterThan(rightIndex);
    expect(oneWallIndex).toBeGreaterThan(uIndex);
    expect(html).toContain("Need island?");
    expect(html).toContain("YES");
    expect(html).toContain("NO");
    expect(html).toContain("UNKNOWN");
    expect(html).not.toContain("L_SHAPE_ISLAND");
    expect(html).not.toContain("U_SHAPE_ISLAND");
    expect(html).not.toContain(">ISLAND<");
  });
});

describe("ShowroomIntakeApp", () => {
  test("does not expose the internal layout prompt in the Round 1 workflow", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).not.toContain("Layout Prompt");
    expect(html).not.toContain("Leave the interior empty");
  });

  test("does not render an empty cabinet choices step in Round 1", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).not.toContain("Cabinets 6");
    expect(html).not.toContain("6. Layout-Sensitive Cabinet Choices");
    expect(html).not.toContain("Detailed cabinet choices are reserved for the next round.");
  });

  test("opens with future workflow steps disabled so users advance sequentially", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).toContain("Openings");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Round 1 Sales Estimate Only");
    expect(html).not.toContain("Dimension Confidence: ROUGH");
    expect(html).not.toContain("Ready To Generate");
    expect(html).not.toContain("The top-down layout plan updates live as you fill the form.");
  });
});

describe("CabinetFillSummaryPanel", () => {
  test("does not show cabinet-fill metrics until cabinet generation runs after fixed positions are confirmed", () => {
    const html = renderToStaticMarkup(
      <CabinetFillSummaryPanel
        positionsConfirmed={true}
        cabinetFillGenerated={false}
        summary={{
          totalCabinets: 8,
          baseCabinets: { count: 4, linearFeet: 10 },
          wallCabinets: { count: 3, linearFeet: 8 },
          tallCabinets: { count: 1, linearFeet: 3 },
          estimatedFillerWidth: 2,
          salesEstimateOnly: true,
          notForProduction: true
        }}
      />
    );

    expect(html).toContain("Fixed positions confirmed");
    expect(html).toContain("Generate cabinet fill when the fixed positions are ready.");
    expect(html).not.toContain("Base");
    expect(html).not.toContain("Wall");
    expect(html).not.toContain("Tall");
    expect(html).not.toContain("Pricing reserved");
  });

  test("shows a rough cabinet-fill summary without detailed cabinet editing or pricing", () => {
    const html = renderToStaticMarkup(
      <CabinetFillSummaryPanel
        positionsConfirmed={true}
        cabinetFillGenerated={true}
        summary={{
          totalCabinets: 8,
          baseCabinets: { count: 4, linearFeet: 10 },
          wallCabinets: { count: 3, linearFeet: 8 },
          tallCabinets: { count: 1, linearFeet: 3 },
          estimatedFillerWidth: 2,
          salesEstimateOnly: true,
          notForProduction: true
        }}
      />
    );

    expect(html).toContain("Rough cabinet fill");
    expect(html).toContain("Pricing reserved");
    expect(html).not.toContain("Advanced manual cabinet review");
    expect(html).not.toContain("Add Cabinet");
    expect(html).not.toContain("Remove");
    expect(html).not.toContain("sales estimate");
    expect(html).not.toContain("Approximate only");
  });
});

describe("Round1SnapshotPanel", () => {
  test("gates the rendering action and hides the JSON until a snapshot exists", () => {
    const html = renderToStaticMarkup(
      <>
        <RenderingControls
          canRender={false}
          busy={false}
          error={null}
          stale={false}
          image={null}
        />
        <Round1SnapshotPanel snapshot={null} />
      </>
    );

    expect(html).toContain("No snapshot yet");
    expect(html).toContain("Generate Rendering");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Snapshot ready");
    expect(html).not.toContain("View snapshot JSON");
  });

  test("shows snapshot status and the snapshot JSON once generated", () => {
    const html = renderToStaticMarkup(
      <Round1SnapshotPanel snapshot={buildFixtureSnapshot()} />
    );

    expect(html).toContain("Snapshot ready");
    expect(html).toContain("View snapshot JSON");
    expect(html).toContain("cabinetFillGenerated");
    expect(html).toContain("schemaVersion");
    expect(html).not.toContain("Not production");
    expect(html).not.toContain("Sales estimate only");
  });
});

describe("ShowroomIntakeApp snapshot gating", () => {
  test("starts with no snapshot before cabinet fill is generated", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).toContain("No snapshot yet");
    expect(html).not.toContain("Snapshot ready");
    expect(html).not.toContain("View snapshot JSON");
  });

  test("hides rough elevations before cabinet fill is generated", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).not.toContain("Rough Wall Elevations");
    expect(html).not.toContain("Round 1 rough elevation - not for production");
  });
});

describe("snapshot restore guard", () => {
  test("does not apply a late saved snapshot after the current form has changed", () => {
    expect(
      shouldApplySnapshotRestore({
        cancelled: false,
        hasSavedSnapshot: true,
        localSessionChanged: true
      })
    ).toBe(false);
  });

  test("applies a saved snapshot only to an untouched active session", () => {
    expect(
      shouldApplySnapshotRestore({
        cancelled: false,
        hasSavedSnapshot: true,
        localSessionChanged: false
      })
    ).toBe(true);
  });
});
