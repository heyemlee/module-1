import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { CreateUserForm } from "./create-user-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} })
}));

describe("CreateUserForm", () => {
  test("renders account, email, name, role, password fields", () => {
    const html = renderToStaticMarkup(<CreateUserForm />);
    expect(html).toContain("Account");
    expect(html).toContain("Account is used for sign in");
    expect(html).toContain("Email");
    expect(html).toContain("Name");
    expect(html).toContain("Role");
    expect(html).toContain("Temporary password");
    expect(html).toContain("SALES");
    expect(html).toContain("DESIGNER");
    expect(html).toContain("Create user");
  });
});
