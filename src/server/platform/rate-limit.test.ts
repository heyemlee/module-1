import { afterEach, expect, test, vi } from "vitest";
import { __resetRateLimits, clientKey, rateLimit } from "./rate-limit";

afterEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

test("allows up to the limit, then blocks within the window", () => {
  for (let i = 0; i < 3; i++) {
    expect(rateLimit("k", 3, 60_000).ok).toBe(true);
  }
  const blocked = rateLimit("k", 3, 60_000);
  expect(blocked.ok).toBe(false);
  expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
});

test("resets after the window elapses", () => {
  vi.useFakeTimers();
  expect(rateLimit("k", 1, 1_000).ok).toBe(true);
  expect(rateLimit("k", 1, 1_000).ok).toBe(false);
  vi.advanceTimersByTime(1_001);
  expect(rateLimit("k", 1, 1_000).ok).toBe(true);
});

test("keys are independent", () => {
  expect(rateLimit("a", 1, 60_000).ok).toBe(true);
  expect(rateLimit("a", 1, 60_000).ok).toBe(false);
  expect(rateLimit("b", 1, 60_000).ok).toBe(true);
});

test("clientKey reads the first x-forwarded-for hop", () => {
  const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
  expect(clientKey(req)).toBe("1.2.3.4");
  expect(clientKey(new Request("http://x"))).toBe("unknown");
});
