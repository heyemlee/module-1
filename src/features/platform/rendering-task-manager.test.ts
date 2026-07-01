import { describe, expect, test, vi } from "vitest";
import { createRenderingTaskManager } from "./rendering-task-manager";

const input = {
  projectId: "project-1",
  projectName: "Kitchen",
  stateBody: {},
  renderingBody: {}
};

describe("createRenderingTaskManager", () => {
  test("retains running and successful task state outside the caller", async () => {
    let finish!: (value: { id: string }) => void;
    const execute = vi.fn(
      () => new Promise<{ id: string }>((resolve) => {
        finish = resolve;
      })
    );
    const manager = createRenderingTaskManager(execute);

    const promise = manager.start(input);
    expect(manager.getTask("project-1")?.status).toBe("running");

    finish({ id: "render-1" });
    await promise;

    expect(manager.getTask("project-1")).toMatchObject({
      status: "succeeded",
      result: { id: "render-1" }
    });
  });

  test("deduplicates starts while the same project is running", async () => {
    let finish!: (value: { id: string }) => void;
    const execute = vi.fn(
      () => new Promise<{ id: string }>((resolve) => {
        finish = resolve;
      })
    );
    const manager = createRenderingTaskManager(execute);

    const first = manager.start(input);
    const second = manager.start(input);

    expect(first).toBe(second);
    expect(execute).toHaveBeenCalledTimes(1);

    finish({ id: "render-1" });
    await first;
  });

  test("stores failures and allows a retry", async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error("generation failed"))
      .mockResolvedValueOnce({ id: "render-2" });
    const manager = createRenderingTaskManager(execute);

    await manager.start(input);
    expect(manager.getTask("project-1")).toMatchObject({
      status: "failed",
      error: "generation failed"
    });

    await manager.start(input);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(manager.getTask("project-1")?.status).toBe("succeeded");
  });

  test("emits immutable snapshots and dismisses only settled tasks", async () => {
    let finish!: (value: { id: string }) => void;
    const execute = vi.fn(
      () => new Promise<{ id: string }>((resolve) => {
        finish = resolve;
      })
    );
    const manager = createRenderingTaskManager(execute);
    const snapshots: ReadonlyMap<string, unknown>[] = [];
    const unsubscribe = manager.subscribe(() => {
      snapshots.push(manager.getSnapshot());
    });

    const promise = manager.start(input);
    manager.dismiss("project-1");
    expect(manager.getTask("project-1")?.status).toBe("running");

    finish({ id: "render-1" });
    await promise;
    manager.dismiss("project-1");

    expect(manager.getTask("project-1")).toBeUndefined();
    expect(new Set(snapshots).size).toBe(snapshots.length);
    unsubscribe();
  });
});
