import { afterEach, describe, expect, test, vi } from "vitest";
import { resolveSsl } from "./client";

afterEach(() => vi.unstubAllEnvs());

describe("resolveSsl (DB TLS policy)", () => {
  test("an explicit sslmode in the URL takes precedence — let the URL drive it", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveSsl("postgres://h/db?sslmode=require")).toBeUndefined();
  });

  test("no TLS is forced outside production (local dev DBs are plaintext)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveSsl("postgres://h/db")).toBeUndefined();
  });

  test("production without sslmode enforces verified TLS", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveSsl("postgres://h/db")).toEqual({ rejectUnauthorized: true });
  });

  test("DATABASE_SSL_NO_VERIFY=true relaxes verification but still encrypts", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_SSL_NO_VERIFY", "true");
    expect(resolveSsl("postgres://h/db")).toEqual({ rejectUnauthorized: false });
  });
});
