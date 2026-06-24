import { describe, expect, test } from "vitest";
import {
  DEFAULT_WORKSPACE_MODE,
  parseWorkspaceMode,
  workspaceModeStorageKey
} from "./workspace-mode";

describe("workspace mode", () => {
  test("defaults new sessions to guided mode", () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe("guided");
  });

  test("accepts only supported stored values", () => {
    expect(parseWorkspaceMode("guided")).toBe("guided");
    expect(parseWorkspaceMode("canvas")).toBe("canvas");
    expect(parseWorkspaceMode("expanded")).toBe("guided");
    expect(parseWorkspaceMode(null)).toBe("guided");
  });

  test("uses a stable versioned storage key", () => {
    expect(workspaceModeStorageKey).toBe("abcabinet:round1:workspace-mode:v1");
  });
});
