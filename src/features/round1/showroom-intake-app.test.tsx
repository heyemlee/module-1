import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "./showroom-intake-data";
import { AppliancesStep, OpeningsStep } from "./showroom-intake-app";

describe("OpeningsStep", () => {
  test("does not render first-phase door or window width inputs", () => {
    const html = renderToStaticMarkup(
      <OpeningsStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).not.toContain("Door width if known");
    expect(html).not.toContain("Window width if known");
  });
});

describe("AppliancesStep", () => {
  test("does not render appliance rough-position dropdowns", () => {
    const html = renderToStaticMarkup(
      <AppliancesStep form={createDefaultShowroomForm()} setForm={() => {}} />
    );

    expect(html).not.toContain("Sink position");
    expect(html).not.toContain("Range / cooktop position");
    expect(html).not.toContain("Fridge position");
    expect(html).not.toContain("Dishwasher position");
  });
});
