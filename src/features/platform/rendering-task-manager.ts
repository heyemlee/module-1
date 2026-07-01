export type RenderingTaskInput = {
  projectId: string;
  projectName: string;
  stateBody: unknown;
  renderingBody: unknown;
};

export type RenderingTaskResult = {
  id: string;
} & Record<string, unknown>;

export type RenderingTask = {
  projectId: string;
  projectName: string;
  status: "running" | "succeeded" | "failed";
  result?: RenderingTaskResult;
  error?: string;
};

type ExecuteRenderingTask = (
  input: RenderingTaskInput
) => Promise<RenderingTaskResult>;

type Listener = () => void;

export function createRenderingTaskManager(
  execute: ExecuteRenderingTask,
  onSettled?: (task: RenderingTask) => void
) {
  let snapshot: ReadonlyMap<string, RenderingTask> = new Map();
  const listeners = new Set<Listener>();
  const inFlight = new Map<string, Promise<RenderingTask>>();

  function emit(task?: RenderingTask, removeProjectId?: string) {
    const next = new Map(snapshot);
    if (removeProjectId) next.delete(removeProjectId);
    if (task) next.set(task.projectId, task);
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function start(input: RenderingTaskInput): Promise<RenderingTask> {
    const existing = inFlight.get(input.projectId);
    if (existing) return existing;

    emit({
      projectId: input.projectId,
      projectName: input.projectName,
      status: "running"
    });

    let execution: Promise<RenderingTaskResult>;
    try {
      execution = execute(input);
    } catch (error) {
      execution = Promise.reject(error);
    }

    const promise = execution
      .then((result) => {
        const task: RenderingTask = {
          projectId: input.projectId,
          projectName: input.projectName,
          status: "succeeded",
          result
        };
        emit(task);
        onSettled?.(task);
        return task;
      })
      .catch((error: unknown) => {
        const task: RenderingTask = {
          projectId: input.projectId,
          projectName: input.projectName,
          status: "failed",
          error: error instanceof Error ? error.message : "Rendering failed"
        };
        emit(task);
        onSettled?.(task);
        return task;
      })
      .finally(() => {
        inFlight.delete(input.projectId);
      });

    inFlight.set(input.projectId, promise);
    return promise;
  }

  return {
    start,
    getTask(projectId: string) {
      return snapshot.get(projectId);
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dismiss(projectId: string) {
      if (snapshot.get(projectId)?.status === "running") return;
      emit(undefined, projectId);
    }
  };
}

export type RenderingTaskManager = ReturnType<
  typeof createRenderingTaskManager
>;
