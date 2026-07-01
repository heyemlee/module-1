"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode
} from "react";
import {
  createRenderingTaskManager,
  type RenderingTask,
  type RenderingTaskInput,
  type RenderingTaskManager,
  type RenderingTaskResult
} from "./rendering-task-manager";

type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const RenderingTaskContext = createContext<RenderingTaskManager | null>(null);
const EMPTY_TASKS: ReadonlyMap<string, RenderingTask> = new Map();

async function readRequestError(response: Response) {
  const detail = await response.json().catch(() => null);
  return (
    detail?.reason ||
    detail?.error ||
    `Request failed (${response.status})`
  );
}

export async function executeRenderingTask(
  input: RenderingTaskInput,
  fetchImpl: FetchImpl = fetch
): Promise<RenderingTaskResult> {
  const baseUrl = `/api/projects/${input.projectId}/round1`;
  const savedState = await fetchImpl(`${baseUrl}/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.stateBody)
  });
  if (!savedState.ok) {
    throw new Error(await readRequestError(savedState));
  }

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/renderings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.renderingBody),
      signal: AbortSignal.timeout(120_000)
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error("Rendering timed out. Please try again.");
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(await readRequestError(response));
  }

  return (await response.json()) as RenderingTaskResult;
}

export function RenderingTaskNotice({
  task,
  onDismiss
}: {
  task: RenderingTask;
  onDismiss: () => void;
}) {
  const isRunning = task.status === "running";

  return (
    <section
      aria-live="polite"
      className="pointer-events-auto w-[min(360px,calc(100vw-32px))] rounded-[16px] border border-white/90 bg-white/90 p-4 text-studio-ink shadow-[0_24px_60px_-28px_rgba(20,20,26,0.55)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-1 size-2.5 shrink-0 rounded-full ${
            isRunning
              ? "animate-pulse bg-studio-action"
              : task.status === "succeeded"
                ? "bg-emerald-600"
                : "bg-studio-danger"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">
            {isRunning
              ? `Rendering ${task.projectName}`
              : task.status === "succeeded"
                ? "Rendering complete"
                : "Rendering failed"}
          </p>
          {isRunning ? (
            <p className="mt-1 text-[11px] text-studio-quiet">
              You can keep working anywhere in Studio.
            </p>
          ) : task.status === "succeeded" ? (
            <Link
              href={`/projects/${task.projectId}/renderings`}
              className="mt-2 inline-flex text-[11px] font-semibold underline underline-offset-4"
            >
              View rendering
            </Link>
          ) : (
            <p className="mt-1 break-words text-[11px] text-studio-danger">
              {task.error ?? "Rendering failed"}
            </p>
          )}
        </div>
        {!isRunning && (
          <button
            type="button"
            aria-label="Dismiss rendering status"
            onClick={onDismiss}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#777770] hover:bg-black/5 hover:text-studio-ink"
          >
            ×
          </button>
        )}
      </div>
    </section>
  );
}

export function RenderingTaskProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const managerRef = useRef<RenderingTaskManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = createRenderingTaskManager(
      executeRenderingTask,
      (task) => {
        if (task.status === "succeeded") routerRef.current.refresh();
      }
    );
  }
  const manager = managerRef.current;
  const tasks = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    () => EMPTY_TASKS
  );

  return (
    <RenderingTaskContext.Provider value={manager}>
      {children}
      {tasks.size > 0 && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-3">
          {[...tasks.values()].map((task) => (
            <RenderingTaskNotice
              key={task.projectId}
              task={task}
              onDismiss={() => manager.dismiss(task.projectId)}
            />
          ))}
        </div>
      )}
    </RenderingTaskContext.Provider>
  );
}

export function useRenderingTask(projectId?: string) {
  const manager = useContext(RenderingTaskContext);
  if (!manager) {
    throw new Error("useRenderingTask must be used within RenderingTaskProvider");
  }

  const task = useSyncExternalStore(
    manager.subscribe,
    () => (projectId ? manager.getTask(projectId) : undefined),
    () => undefined
  );

  return {
    task,
    startRendering: manager.start,
    dismissRenderingTask: manager.dismiss
  };
}
