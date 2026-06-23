import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { CreateUserForm } from "./create-user-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} })
}));

describe("CreateUserForm", () => {
  test("renders only account, role, and password fields", () => {
    const html = renderToStaticMarkup(<CreateUserForm />);
    expect(html).toContain("Account");
    expect(html).toContain("Role");
    expect(html).toContain(">Password<");
    expect(html).toContain("SALES");
    expect(html).toContain("DESIGNER");
    expect(html).toContain("Create user");
    expect(html).not.toContain("Account is used for sign in");
    expect(html).not.toContain(">Email<");
    expect(html).not.toContain(">Name<");
    expect(html).not.toContain("Temporary password");
    expect(html).not.toContain("min 8 characters");
  });
});
