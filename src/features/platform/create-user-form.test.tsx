import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CreateUserForm } from "./create-user-form";

describe("CreateUserForm", () => {
  test("renders email, name, role, password fields", () => {
    const html = renderToStaticMarkup(<CreateUserForm />);
    expect(html).toContain("Email");
    expect(html).toContain("Name");
    expect(html).toContain("Role");
    expect(html).toContain("Temporary password");
    expect(html).toContain("SALES");
    expect(html).toContain("DESIGNER");
    expect(html).toContain("Create user");
  });
});
