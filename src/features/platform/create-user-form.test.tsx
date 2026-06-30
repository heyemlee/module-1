import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { CreateUserForm } from "./create-user-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} })
}));

describe("CreateUserForm", () => {
  test("renders the create-user modal with account, role, password, quota", () => {
    const html = renderToStaticMarkup(
      <CreateUserForm onClose={() => {}} currentUserRole="OWNER" />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("NEW USER");
    expect(html).toContain("Create a user");
    expect(html).toContain("ACCOUNT");
    expect(html).toContain("ROLE");
    expect(html).toContain("PASSWORD");
    expect(html).toContain("MONTHLY QUOTA");
    expect(html).toContain("SALES");
    expect(html).toContain("DESIGNER");
    expect(html).toContain("ADMIN");
    expect(html).toContain("Create user");
    expect(html).toContain("At least 8 characters");
    expect(html).toContain("studio");
    expect(html).toMatch(/<select/);
    expect(html).not.toContain(">Email<");
    expect(html).not.toContain(">Name<");
  });

  test("an admin can only create roles below it — never another admin", () => {
    const html = renderToStaticMarkup(
      <CreateUserForm onClose={() => {}} currentUserRole="ADMIN" />
    );

    expect(html).toContain("SALES");
    expect(html).toContain("DESIGNER");
    expect(html).not.toContain(">ADMIN<");
  });
});
