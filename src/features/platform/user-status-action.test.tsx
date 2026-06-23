import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { UserStatusAction, userStatusEndpoint } from "./user-status-action";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} })
}));

describe("UserStatusAction", () => {
  test("offers Pause for an active user", () => {
    const html = renderToStaticMarkup(
      <UserStatusAction userId="user-2" disabled={false} />
    );

    expect(html).toContain(">Pause<");
  });

  test("offers Activate for a disabled user", () => {
    const html = renderToStaticMarkup(
      <UserStatusAction userId="user-2" disabled />
    );

    expect(html).toContain(">Activate<");
  });

  test("targets the selected user's status endpoint", () => {
    expect(userStatusEndpoint("user-2")).toBe("/api/admin/users/user-2/status");
  });
});
