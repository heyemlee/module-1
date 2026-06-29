import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  test("renders an account/password-only sign in form", () => {
    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain("ACCOUNT");
    expect(html).toContain("PASSWORD");
    expect(html).toContain("Remember me");
    expect(html).toContain("Enter Studio");
    expect(html).toContain("mei.lin");
    expect(html).not.toContain("Continue with Google");
    expect(html).not.toContain("Continue with Apple");
    expect(html).not.toContain("Continue with GitHub");
    expect(html).not.toContain("Forgot password");
    expect(html).not.toContain("Sign Up");
  });

  test("uses the Studio theme + handoff brand copy", () => {
    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain("ABCABINET");
    expect(html).toContain("From conversation to kitchen concept");
    expect(html).not.toContain("--font-playfair");
    expect(html).not.toContain("--font-instrument-serif");
    expect(html).not.toContain("Secure");
  });
});
