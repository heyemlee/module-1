import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round1StepNavigation } from "./round1-step-navigation";

const steps = ["Room", "Openings", "Layout", "Appliances"] as const;

describe("Round1StepNavigation", () => {
  test("announces current, completed, available, and locked steps", () => {
    const html = renderToStaticMarkup(
      <Round1StepNavigation
        steps={steps}
        currentStep={1}
        maxAccessibleStep={2}
        variant="expanded"
        onStepChange={() => {}}
      />
    );

    expect(html).toContain('aria-current="step"');
    expect(html).toContain('data-step-state="completed"');
    expect(html).toContain('data-step-state="current"');
    expect(html).toContain('data-step-state="available"');
    expect(html).toContain('data-step-state="locked"');
  });

  test("uses the same labels in compact mode", () => {
    const html = renderToStaticMarkup(
      <Round1StepNavigation
        steps={steps}
        currentStep={2}
        maxAccessibleStep={2}
        variant="compact"
        onStepChange={() => {}}
      />
    );

    expect(html).toContain('aria-label="Room, completed"');
    expect(html).toContain('aria-label="Layout, current step"');
  });
});
