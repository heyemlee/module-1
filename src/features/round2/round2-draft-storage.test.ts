import { describe, expect, test } from "vitest";
import { createRound2PrototypeState } from "./round2-state";
import {
  loadRound2Draft,
  round2DraftStorageKey,
  saveRound2Draft
} from "./round2-draft-storage";
import type { Round2PrototypeState } from "./round2-types";

describe("Round 2 draft storage", () => {
  test("saves and restores the project-specific prototype state", () => {
    const storage = new MemoryStorage();
    const state: Round2PrototypeState = {
      ...createRound2PrototypeState("SALES"),
      referenceLocked: true,
      referenceSnapshotId: "snapshot-1",
      task: "MEASUREMENT",
      measurements: {
        "wall.wall-a.length": 2400
      }
    };

    saveRound2Draft(storage, "project-1", state);

    expect(storage.getItem(round2DraftStorageKey("project-1"))).toContain(
      '"version":1'
    );
    expect(loadRound2Draft(storage, "project-1")).toMatchObject({
      referenceLocked: true,
      referenceSnapshotId: "snapshot-1",
      measurements: {
        "wall.wall-a.length": 2400
      }
    });
    expect(loadRound2Draft(storage, "project-2")).toBeNull();
  });

  test("ignores corrupted, unsupported, and incomplete draft payloads", () => {
    const storage = new MemoryStorage();
    const key = round2DraftStorageKey("project-1");

    storage.setItem(key, "{not json");
    expect(loadRound2Draft(storage, "project-1")).toBeNull();

    storage.setItem(
      key,
      JSON.stringify({
        version: 99,
        state: createRound2PrototypeState("SALES")
      })
    );
    expect(loadRound2Draft(storage, "project-1")).toBeNull();

    storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        state: { task: "MEASUREMENT" }
      })
    );
    expect(loadRound2Draft(storage, "project-1")).toBeNull();
  });
});

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}
