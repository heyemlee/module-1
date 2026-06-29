import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Round1Feedback } from "@/features/round1/round1-feedback";

describe("Round1Feedback", () => {
  it("announces saved feedback as a polite status", () => {
    const html = renderToStaticMarkup(
      <Round1Feedback state="saved" message="Changes saved" />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-feedback-state="saved"');
    expect(html).toContain("Changes saved");
  });

  it("announces errors assertively", () => {
    const html = renderToStaticMarkup(
      <Round1Feedback state="error" message="Could not save changes" />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("Could not save changes");
  });

  it.each(["saving", "stale", "generating", "success"] as const)(
    "announces %s feedback as a polite status",
    (state) => {
      const html = renderToStaticMarkup(
        <Round1Feedback state={state} message={`${state} message`} />
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain(`data-feedback-state="${state}"`);
      expect(html).toContain(`${state} message`);
    }
  );

  it.each(["saving", "generating"] as const)(
    "limits the %s loading animation to motion-safe environments",
    (state) => {
      const html = renderToStaticMarkup(
        <Round1Feedback state={state} message={`${state} message`} />
      );

      const classNames = Array.from(html.matchAll(/class="([^"]*)"/g)).flatMap(
        ([, value]) => value.split(" ")
      );

      expect(html).toContain("motion-safe:animate-spin");
      expect(classNames).not.toContain("animate-spin");
    }
  );
});

describe("Studio controls", () => {
  it("provides tactile Studio button variants and sizes", () => {
    const baseClasses = buttonVariants();
    const inspectorClasses = buttonVariants({ variant: "inspector" });
    const iconClasses = buttonVariants({ size: "icon" });

    expect(baseClasses).toContain("rounded-studio-control");
    expect(baseClasses).toContain("text-[13px]");
    expect(baseClasses).toContain("font-semibold");
    expect(baseClasses).toContain("motion-safe:hover:-translate-y-px");
    expect(baseClasses).toContain("motion-safe:active:scale-[0.98]");
    expect(baseClasses).toContain("aria-busy:cursor-wait");
    expect(baseClasses).toContain("h-10");
    expect(inspectorClasses).toContain("bg-studio-paper");
    expect(inspectorClasses).toContain("text-studio-paper-ink");
    expect(iconClasses).toContain("size-10");
  });

  it("renders the Studio dark input and inspector surface", () => {
    const html = renderToStaticMarkup(
      <Input data-surface="inspector" placeholder="Search projects" />
    );

    expect(html).toContain('data-surface="inspector"');
    expect(html).toContain("h-10");
    expect(html).toContain("bg-white/60");
    expect(html).toContain("data-[surface=inspector]:bg-studio-paper");
    expect(html).toContain("placeholder:text-studio-muted");
  });

  it("renders Radix checkbox indicators at the Studio control size", () => {
    const checkedHtml = renderToStaticMarkup(<Checkbox checked />);
    const indeterminateHtml = renderToStaticMarkup(
      <Checkbox checked="indeterminate" />
    );

    expect(checkedHtml).toContain("size-5");
    expect(checkedHtml).toContain('width="15"');
    expect(indeterminateHtml).toContain('width="15"');
    expect(checkedHtml).not.toContain('width="9"');
    expect(indeterminateHtml).not.toContain('width="9"');
  });
});
