export const workspaceModeStorageKey =
  "abcabinet:round1:workspace-mode:v1";

export type WorkspaceMode = "guided" | "canvas";

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = "guided";

export function parseWorkspaceMode(value: string | null): WorkspaceMode {
  return value === "canvas" || value === "guided"
    ? value
    : DEFAULT_WORKSPACE_MODE;
}
