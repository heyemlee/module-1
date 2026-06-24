import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { UserQuotaAction, userQuotaEndpoint } from "./user-quota-action";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} })
}));

describe("UserQuotaAction", () => {
  test("renders a labelled quota value and edit action", () => {
    const html = renderToStaticMarkup(
      <UserQuotaAction userId="user-2" userName="Sales" initialQuota={50} />
    );
    expect(html).toContain("50");
    expect(html).toContain('aria-label="Edit Sales monthly quota"');
  });

  test("targets the selected user quota endpoint", () => {
    expect(userQuotaEndpoint("user 2")).toBe(
      "/api/admin/users/user%202/quota"
    );
  });
});
