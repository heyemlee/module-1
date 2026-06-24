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
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toMatch(/<input[^>]*required=""[^>]*name="account"[^>]*value=""/);
    expect(html).toMatch(/<select[^>]*name="role"/);
    expect(html).toMatch(/<input[^>]*minLength="8"[^>]*required=""[^>]*name="password"[^>]*value=""/);
    expect(html).toMatch(/<input[^>]*min="0"[^>]*required=""[^>]*name="monthlyRenderQuota"[^>]*value="50"/);
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
  });
});
