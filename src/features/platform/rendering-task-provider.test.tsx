import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { RenderingTask } from "./rendering-task-manager";
import {
  executeRenderingTask,
  RenderingTaskNotice
} from "./rendering-task-provider";

describe("executeRenderingTask", () => {
  test("saves state before starting the rendering request", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return new Response(
        url.endsWith("/state")
          ? null
          : JSON.stringify({ id: "render-1", imageBase64: "png" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    });

    const result = await executeRenderingTask(
      {
        projectId: "project-1",
        projectName: "Kitchen",
        stateBody: { showroomForm: {} },
        renderingBody: { referenceImages: [] }
      },
      fetchImpl
    );

    expect(calls).toEqual([
      "/api/projects/project-1/round1/state",
      "/api/projects/project-1/round1/renderings"
    ]);
    expect(result.id).toBe("render-1");
  });

  test("surfaces the server reason and skips rendering after a save failure", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ reason: "save failed" }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(
      executeRenderingTask(
        {
          projectId: "project-1",
          projectName: "Kitchen",
          stateBody: {},
          renderingBody: {}
        },
        fetchImpl
      )
    ).rejects.toThrow("save failed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("RenderingTaskNotice", () => {
  function render(task: RenderingTask) {
    return renderToStaticMarkup(
      <RenderingTaskNotice task={task} onDismiss={() => {}} />
    );
  }

  test("shows running, successful, and failed task states", () => {
    const runningHtml = render({
      projectId: "project-1",
      projectName: "Kitchen",
      status: "running"
    });
    expect(runningHtml).toContain("Rendering Kitchen");
    expect(runningHtml).not.toContain("Dismiss");

    const successHtml = render({
      projectId: "project-1",
      projectName: "Kitchen",
      status: "succeeded",
      result: { id: "render-1" }
    });
    expect(successHtml).toContain("/projects/project-1/renderings");
    expect(successHtml).toContain("Rendering complete");

    const failedHtml = render({
      projectId: "project-1",
      projectName: "Kitchen",
      status: "failed",
      error: "generation failed"
    });
    expect(failedHtml).toContain("generation failed");
    expect(failedHtml).toContain("Dismiss");
  });
});
