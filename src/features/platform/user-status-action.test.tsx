import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { UserStatusAction, userStatusEndpoint } from "./user-status-action";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} })
}));

describe("UserStatusAction", () => {
  test("offers Disable for an active user", () => {
    const html = renderToStaticMarkup(
      <UserStatusAction userId="user-2" userName="Sales" disabled={false} />
    );

    expect(html).toContain(">Disable<");
    expect(html).toContain('aria-label="Pause Sales"');
  });

  test("offers Enable for a disabled user", () => {
    const html = renderToStaticMarkup(
      <UserStatusAction userId="user-2" userName="Sales" disabled />
    );

    expect(html).toContain(">Enable<");
    expect(html).toContain('aria-label="Activate Sales"');
  });

  test("targets the selected user's status endpoint", () => {
    expect(userStatusEndpoint("user-2")).toBe("/api/admin/users/user-2/status");
  });
});
