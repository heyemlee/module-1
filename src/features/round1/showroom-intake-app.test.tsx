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
  RenderingControls,
  Round1InlineRenderPreview
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
  const componentName =
    "displayName" in Component
      ? String((Component as { displayName?: string }).displayName ?? "")
      : String((Component as { name?: string }).name ?? "");
  if (/DropdownMenu|Popover|Primitive|Menu/.test(componentName)) {
    return "";
  }
  try {
    return Component(element.props);
  } catch {
    return "";
  }
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

type OpeningButtonProps = ElementWithChildrenProps & {
  onClick: () => void;
  "data-opening"?: string;
};

function findOpeningButton(
  node: ReactNode,
  key: string
): ReactElement<OpeningButtonProps> | null {
  if (node === null || node === undefined || typeof node === "boolean") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findOpeningButton(child, key);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (typeof node.type === "function") {
    return findOpeningButton(renderFunctionElement(node), key);
  }
  if (
    node.type === "button" &&
    (node.props as OpeningButtonProps)["data-opening"] === key
  ) {
    return node as ReactElement<OpeningButtonProps>;
  }
  return findOpeningButton(childrenOf(node), key);
}

function findButtonByAttr(
  node: ReactNode,
  attr: string,
  value: string
): ReactElement<{ onClick: () => void }> | null {
  if (node === null || node === undefined || typeof node === "boolean") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findButtonByAttr(child, attr, value);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (typeof node.type === "function") {
    return findButtonByAttr(renderFunctionElement(node), attr, value);
  }
  if (
    node.type === "button" &&
    (node.props as Record<string, unknown>)[attr] === value
  ) {
    return node as ReactElement<{ onClick: () => void }>;
  }
  return findButtonByAttr(childrenOf(node), attr, value);
}

describe("OpeningsStep", () => {
  test("does not render first-phase door or window width inputs", () => {
    const html = renderToStaticMarkup(
      <OpeningsStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).not.toContain("Door width if known");
    expect(html).not.toContain("Window width if known");
  });

  test("presents Door and Window as toggles, not wall/relation selects", () => {
    const html = renderToStaticMarkup(
      <OpeningsStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).toContain("Openings");
    expect(html).toContain("Door");
    expect(html).toContain("Window");
    // The wall/relation/kind selects are now set by dragging on the plan.
    expect(html).not.toContain("Window approximate relation");
    expect(html).not.toContain("Door or open passage?");
    expect(html).not.toContain("Door / opening wall");
  });

  test("toggling Door on records the opening in the form", () => {
    const form = createDefaultShowroomForm();
    form.openings.doors = { status: "NO", items: [] };
    let nextForm = form;
    const tree = (
      <OpeningsStep form={form} setForm={(value) => { nextForm = value; }} />
    );

    const button = findOpeningButton(tree, "door");
    expect(button).not.toBeNull();

    button!.props.onClick();

    expect(nextForm.openings.doors.status).toBe("YES");
    expect(nextForm.openings.doors.items.length).toBeGreaterThan(0);
  });

  test("toggling Window off clears its status and items", () => {
    const form = createDefaultShowroomForm();
    form.openings.windows = {
      status: "YES",
      items: [{ relation: "BACK_SIDE", width: null }]
    };
    let nextForm = form;
    const tree = (
      <OpeningsStep form={form} setForm={(value) => { nextForm = value; }} />
    );

    const button = findOpeningButton(tree, "window");
    expect(button).not.toBeNull();

    button!.props.onClick();

    expect(nextForm.openings.windows.status).toBe("NO");
    expect(nextForm.openings.windows.items).toEqual([]);
  });
  test("rendering controls expose generating and stale states without a generic spinner", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender={false}
        busy
        error={null}
        renderings={[]}
        cabinetColors={[]}
      />
    );

    expect(html).toContain("Building concept rendering");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("border-t-transparent");
  });
});

describe("AppliancesStep", () => {
  test("asks only rough presence for cooking appliances", () => {
    const html = renderToStaticMarkup(
      <AppliancesStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).toContain("Appliances present");
    expect(html).toContain("Range (with oven)");
    expect(html).toContain("Cooktop");
    expect(html).toContain("Wall oven");
    expect(html).toContain("Built-in microwave");
    expect(html).not.toContain("Range size");
    expect(html).not.toContain("Cooktop size");
    expect(html).not.toContain("Oven / microwave");
    expect(html).not.toContain("Oven / microwave position");
  });


  test("shows oven and microwave arrangement only when both wall oven and microwave are included", () => {
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
              microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
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

    expect(hiddenHtml).not.toContain("Wall oven + microwave placement");
    expect(visibleHtml).toContain("Wall oven + microwave placement");
    expect(visibleHtml).toContain("WALL_OVEN_MICROWAVE_STACK");
    expect(visibleHtml).toContain("SEPARATE_WALL_OVEN_AND_MICROWAVE");
    expect(visibleHtml).toContain("Stacked");
    expect(visibleHtml).toContain("Separate");
  });

  test("maps oven and microwave placement changes into appliance statuses", () => {
    const cases = [
      "WALL_OVEN_MICROWAVE_STACK",
      "SEPARATE_WALL_OVEN_AND_MICROWAVE"
    ] as const;

    for (const configuration of cases) {
      const form = createDefaultShowroomForm();
      let nextForm = form;
      const button = findButtonByAttr(
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
                  status: "YES",
                  relation: "UNKNOWN"
                }
              }
            }
          }}
          setForm={(updatedForm) => {
            nextForm = updatedForm;
          }}
        />,
        "data-oven",
        configuration
      );

      expect(button).not.toBeNull();
      button!.props.onClick();

      expect(
        nextForm.layoutSensitiveCabinets.ovenMicrowave
      ).toMatchObject({
        configuration,
        relation: "UNKNOWN"
      });
      expect(
        nextForm.layoutSensitiveCabinets.cookingAppliances.wallOven
      ).toEqual({ status: "YES", relation: "UNKNOWN" });
      expect(
        nextForm.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo
      ).toEqual({ status: "YES", relation: "UNKNOWN" });
    }
  });

  test("resets stale oven and microwave arrangement when microwave status changes directly", () => {
    const form = createDefaultShowroomForm();
    let nextForm = form;
    const button = findButtonByAttr(
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
      "data-appl",
      "microwave"
    );

    expect(button).not.toBeNull();
    button!.props.onClick();

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
    const button = findButtonByAttr(
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
      "data-appl",
      "microwave"
    );

    expect(button).not.toBeNull();
    button!.props.onClick();

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
  test("rendering controls expose generating and stale states without a generic spinner", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender={false}
        busy
        error={null}
        renderings={[]}
        cabinetColors={[]}
      />
    );

    expect(html).toContain("Building concept rendering");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("border-t-transparent");
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
    expect(html).toContain("Center island");
    expect(html).not.toContain("L_SHAPE_ISLAND");
    expect(html).not.toContain("U_SHAPE_ISLAND");
    expect(html).not.toContain(">ISLAND<");
  });

  test("uses a three-state Yes/No/Unsure control for the island", () => {
    const form = createDefaultShowroomForm();
    let nextForm = form;
    const tree = (
      <LayoutStep
        form={form}
        setForm={(value) => {
          nextForm = value;
        }}
        setPositionOverrides={() => {}}
      />
    );
    const html = renderToStaticMarkup(tree);

    expect(html).toContain("Center island");
    expect(html).toContain("Unsure");
    expect(html).not.toContain("checkbox");

    const unsure = findButtonByAttr(tree, "data-island", "UNKNOWN");
    expect(unsure).not.toBeNull();
    unsure!.props.onClick();
    expect(nextForm.layoutSensitiveCabinets.island.status).toBe("UNKNOWN");
  });
  test("rendering controls expose generating and stale states without a generic spinner", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender={false}
        busy
        error={null}
        renderings={[]}
        cabinetColors={[]}
      />
    );

    expect(html).toContain("Building concept rendering");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("border-t-transparent");
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

  test("includes Rendering Preferences as the sixth showroom step", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).toContain("Rendering Preferences");
  });
  test("rendering controls expose generating and stale states without a generic spinner", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender={false}
        busy
        error={null}
        renderings={[]}
        cabinetColors={[]}
      />
    );

    expect(html).toContain("Building concept rendering");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("border-t-transparent");
  });
});

describe("Round1InlineRenderPreview", () => {
  const baseProps = {
    cabinetColors: [{ id: "gr", name: "Graphite" }],
    styleLabel: "European Frameless"
  };

  test("shows the render-cube loader while generating", () => {
    const html = renderToStaticMarkup(
      <Round1InlineRenderPreview
        busy
        error={null}
        renderings={[]}
        {...baseProps}
      />
    );
    expect(html).toContain("cmx-cube");
    expect(html).toContain("RENDER");
  });

  test("shows the latest concept image with style/color meta", () => {
    const html = renderToStaticMarkup(
      <Round1InlineRenderPreview
        busy={false}
        error={null}
        renderings={[{ id: "r1", url: "data:image/png;base64,abc", doorColorId: "gr" }]}
        {...baseProps}
      />
    );
    expect(html).toContain("data:image/png;base64,abc");
    expect(html).toContain("EUROPEAN FRAMELESS · GRAPHITE");
    expect(html).not.toContain("LATEST CONCEPT");
    expect(html).not.toContain("View all");
    expect(html).not.toContain("Close preview");
  });

  test("shows a carousel count only when more than one rendering exists", () => {
    const single = renderToStaticMarkup(
      <Round1InlineRenderPreview
        busy={false}
        error={null}
        renderings={[{ id: "r1", url: "u1", doorColorId: "gr" }]}
        {...baseProps}
      />
    );
    expect(single).not.toContain("1 / 1");

    const many = renderToStaticMarkup(
      <Round1InlineRenderPreview
        busy={false}
        error={null}
        renderings={[
          { id: "r2", url: "u2", doorColorId: "gr" },
          { id: "r1", url: "u1", doorColorId: "gr" }
        ]}
        {...baseProps}
      />
    );
    expect(many).toContain("1 / 2");
    expect(many).toContain('aria-label="Previous rendering"');
    expect(many).toContain('aria-label="Next rendering"');
  });

  test("surfaces a generation error", () => {
    const html = renderToStaticMarkup(
      <Round1InlineRenderPreview
        busy={false}
        error="Rendering failed"
        renderings={[]}
        {...baseProps}
      />
    );
    expect(html).toContain("Could not generate the rendering: Rendering failed");
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
  test("rendering controls expose generating and stale states without a generic spinner", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender={false}
        busy
        error={null}
        renderings={[]}
        cabinetColors={[]}
      />
    );

    expect(html).toContain("Building concept rendering");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("border-t-transparent");
  });
});

describe("Round1SnapshotPanel", () => {
  test("shows rendering status without exposing a sidebar generate action", () => {
    const html = renderToStaticMarkup(
      <>
        <RenderingControls
          canRender={false}
          busy={false}
          error={null}
          renderings={[]}
          cabinetColors={[]}
        />
        <Round1SnapshotPanel snapshot={null} />
      </>
    );

    expect(html).toContain("No snapshot yet");
    expect(html).toContain(
      "Available after cabinet fill is generated and a cabinet color is confirmed."
    );
    expect(html).not.toContain("Generate Rendering");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Snapshot ready");
    expect(html).not.toContain("View snapshot JSON");
  });

  
  test("exposes the rendering as an enlarge trigger and keeps the zoom dialog closed in SSR", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender
        busy={false}
        error={null}
        renderings={[{ id: "1", url: "data:image/png;base64,abc", doorColorId: null }]}
        cabinetColors={[]}
      />
    );

    // Thumbnail is a focusable button that opens the fullscreen Dialog.
    expect(html).toContain('aria-label="Enlarge concept rendering"');
    expect(html).toContain('alt="Round 1 concept rendering"');
    // Radix Dialog is closed by default, so the portaled fullscreen image must
    // not be server-rendered (this is what keeps SSR markup stable).
    expect(html).not.toContain('alt="Fullscreen rendering"');
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
  test("rendering controls expose generating and stale states without a generic spinner", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender={false}
        busy
        error={null}
        renderings={[]}
        cabinetColors={[]}
      />
    );

    expect(html).toContain("Building concept rendering");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("border-t-transparent");
  });
});

describe("ShowroomIntakeApp snapshot gating", () => {
  test("starts with no snapshot before cabinet fill is generated", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).toContain("DRAFT SAVED");
    expect(html).not.toContain("Snapshot ready");
    expect(html).not.toContain("View snapshot JSON");
  });

  test("hides rough elevations before cabinet fill is generated", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).not.toContain("Rough Wall Elevations");
    expect(html).not.toContain("Round 1 rough elevation - not for production");
  });

  test("does not expose the rendering generate action outside the final step", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).toContain("Rendering Preferences");
    expect(html).not.toContain("Generate Rendering");
  });
  test("rendering controls expose generating and stale states without a generic spinner", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender={false}
        busy
        error={null}
        renderings={[]}
        cabinetColors={[]}
      />
    );

    expect(html).toContain("Building concept rendering");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("border-t-transparent");
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
  test("rendering controls expose generating and stale states without a generic spinner", () => {
    const html = renderToStaticMarkup(
      <RenderingControls
        canRender={false}
        busy
        error={null}
        renderings={[]}
        cabinetColors={[]}
      />
    );

    expect(html).toContain("Building concept rendering");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("border-t-transparent");
  });
});
