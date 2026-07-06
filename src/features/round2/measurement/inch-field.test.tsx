import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { InchField } from "./inch-field";

function render(value: number | null, disabled = false) {
  return renderToStaticMarkup(
    <InchField
      ariaLabel="Wall A length"
      value={value}
      disabled={disabled}
      onChange={() => {}}
    />
  );
}

describe("InchField", () => {
  test("splits a sixteenths value into whole inches and a selected fraction", () => {
    // 40 sixteenths = 2 1/2"  ->  whole "2", fraction option index 8 selected.
    const html = render(40);
    expect(html).toContain('value="2"');
    expect(html).toContain('<option value="8" selected="">1/2</option>');
  });

  test("renders an empty whole field and the whole-inch fraction when unmeasured", () => {
    const html = render(null);
    expect(html).toContain('value=""');
    expect(html).toContain('<option value="0" selected="">—</option>');
  });

  test("selects the whole-inch option when the value has no fractional part", () => {
    const html = render(16); // 1"
    expect(html).toContain('value="1"');
    expect(html).toContain('<option value="0" selected="">—</option>');
  });
});
