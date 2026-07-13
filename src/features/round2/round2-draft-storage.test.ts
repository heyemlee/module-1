import { describe, expect, test } from "vitest";
import { createRound2PrototypeState } from "./round2-state";
import {
  archiveRound2Draft,
  loadRound2Draft,
  reconcileDraftWithBasis,
  round2DraftArchiveKey,
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

  test("resumes a draft only when it was built on the current basis", () => {
    const draft: Round2PrototypeState = {
      ...createRound2PrototypeState("SALES"),
      referenceLocked: true,
      referenceVersion: 2,
      referenceSnapshotId: "snapshot-2"
    };

    expect(
      reconcileDraftWithBasis(draft, { version: 2, snapshotId: "snapshot-2" })
    ).toBe("RESUME");
    // Relocked basis (newer version) — draft must be archived, not resumed.
    expect(
      reconcileDraftWithBasis(draft, { version: 3, snapshotId: "snapshot-3" })
    ).toBe("ARCHIVE_AND_ADOPT");
    // Same client-side version but different snapshot (old client-lock flow).
    expect(
      reconcileDraftWithBasis(draft, { version: 2, snapshotId: "snapshot-9" })
    ).toBe("ARCHIVE_AND_ADOPT");
    // No draft, or a draft that never locked anything, has nothing to keep.
    expect(
      reconcileDraftWithBasis(null, { version: 1, snapshotId: "snapshot-1" })
    ).toBe("ADOPT");
    expect(
      reconcileDraftWithBasis(createRound2PrototypeState("SALES"), {
        version: 1,
        snapshotId: "snapshot-1"
      })
    ).toBe("ADOPT");
  });

  test("archives a draft under its basis version without touching the live key", () => {
    const storage = new MemoryStorage();
    const draft: Round2PrototypeState = {
      ...createRound2PrototypeState("SALES"),
      referenceLocked: true,
      referenceVersion: 1,
      referenceSnapshotId: "snapshot-1",
      measurements: { "wall.wall-a.length": 2400 }
    };
    saveRound2Draft(storage, "project-1", draft);

    expect(archiveRound2Draft(storage, "project-1", draft)).toBe(true);

    const archived = storage.getItem(round2DraftArchiveKey("project-1", 1));
    expect(archived).toContain('"snapshot-1"');
    // The live draft is untouched so a matching basis can still resume it.
    expect(loadRound2Draft(storage, "project-1")).toMatchObject({
      referenceSnapshotId: "snapshot-1"
    });
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
