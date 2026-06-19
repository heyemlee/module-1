import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./passwords";

describe("password helpers", () => {
  test("verifies a matching password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  test("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});
