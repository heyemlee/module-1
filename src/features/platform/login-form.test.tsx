import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  test("renders an account/password-only sign in form", () => {
    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain("Account");
    expect(html).toContain("Password");
    expect(html).toContain("Remember me");
    expect(html).toContain("Sign In");
    expect(html).toContain("Enter your account");
    expect(html).toContain("Enter your password");
    expect(html).not.toContain("Continue with Google");
    expect(html).not.toContain("Continue with Apple");
    expect(html).not.toContain("Continue with GitHub");
    expect(html).not.toContain("Forgot password");
    expect(html).not.toContain("Sign Up");
  });
});
