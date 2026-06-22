import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  normalizeRound1Form,
  type Round1FormInput,
  type Round1NormalizationResult
} from "@/domain/round1";
// Type-only dependency. The Round 1 snapshot is a feature-layer artifact
// (it aggregates domain output with feature geometry); the repository only
// persists it as data, so importing the type here is runtime-safe and does not
// pull any client code onto the server.
import type { Round1Snapshot } from "@/features/round1/snapshot";
import type { Round1RenderingPreferenceStamp } from "./rendering-service";

/**
 * Non-authoritative concept rendering stored alongside a project.
 *
 * This is a customer-facing preview only and is deliberately kept OUT of
 * `Round1Snapshot`: it never affects snapshot validity, readiness, or any
 * cabinet/dimension/geometry/quote data. It is retained so the last preview
 * survives a reload. `basedOnSnapshotGeneratedAt` lets the UI flag it as stale
 * once the snapshot is later regenerated.
 */
export type Round1ProjectRendering = {
  model: string;
  imageBase64: string;
  prompt: string;
  size: string;
  basedOnSnapshotGeneratedAt: string;
  basedOnRenderingPreferences: Round1RenderingPreferenceStamp | null;
  salesEstimateOnly: true;
  notForProduction: true;
  dimensionConfidence: "ROUGH";
  createdAt: string;
};

export type Round1Project = {
  id: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  round1?: Round1NormalizationResult;
  snapshot?: Round1Snapshot;
  latestRendering?: Round1ProjectRendering;
};

export type Round1Repository = {
  createProject(input: { customerName: string }): Promise<Round1Project>;
  saveShowroomForm(
    projectId: string,
    form: Round1FormInput
  ): Promise<Round1NormalizationResult>;
  saveSnapshot(
    projectId: string,
    snapshot: Round1Snapshot
  ): Promise<Round1Project>;
  saveRendering(
    projectId: string,
    rendering: Omit<Round1ProjectRendering, "createdAt">
  ): Promise<Round1Project>;
  getProject(projectId: string): Promise<Round1Project | null>;
};

type RepositoryOptions = {
  createId?: () => string;
  now?: () => Date;
};

export function createInMemoryRound1Repository(
  options: RepositoryOptions = {}
): Round1Repository {
  const projects = new Map<string, Round1Project>();
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  return {
    async createProject(input) {
      const timestamp = now().toISOString();
      const project: Round1Project = {
        id: createId(),
        customerName: input.customerName,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      projects.set(project.id, project);
      return project;
    },

    async saveShowroomForm(projectId, form) {
      const project = requireProject(projects.get(projectId));
      const round1 = normalizeRound1Form(form);
      projects.set(projectId, {
        ...project,
        updatedAt: now().toISOString(),
        round1
      });
      return round1;
    },

    async saveSnapshot(projectId, snapshot) {
      const project = requireProject(projects.get(projectId));
      const updated: Round1Project = {
        ...project,
        updatedAt: now().toISOString(),
        snapshot
      };
      projects.set(projectId, updated);
      return updated;
    },

    async saveRendering(projectId, rendering) {
      const project = requireProject(projects.get(projectId));
      const timestamp = now().toISOString();
      const updated: Round1Project = {
        ...project,
        updatedAt: timestamp,
        latestRendering: { ...rendering, createdAt: timestamp }
      };
      projects.set(projectId, updated);
      return updated;
    },

    async getProject(projectId) {
      return projects.get(projectId) ?? null;
    }
  };
}

type StoredProjects = Record<string, Round1Project>;

/**
 * File-backed Round 1 repository. Persists all projects (including the frozen
 * Round 1 snapshot) to a single JSON file so sales data survives a server
 * restart. Lightweight on purpose: read-modify-write a JSON document, which is
 * adequate for the single-showroom MVP and keeps the same swappable interface.
 */
export function createFileSystemRound1Repository(
  options: RepositoryOptions & { filePath: string }
): Round1Repository {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const filePath = resolve(options.filePath);

  async function readAll(): Promise<StoredProjects> {
    try {
      const raw = await readFile(filePath, "utf8");
      return raw.trim() ? (JSON.parse(raw) as StoredProjects) : {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  async function writeAll(projects: StoredProjects): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(projects, null, 2), "utf8");
  }

  return {
    async createProject(input) {
      const projects = await readAll();
      const timestamp = now().toISOString();
      const project: Round1Project = {
        id: createId(),
        customerName: input.customerName,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      projects[project.id] = project;
      await writeAll(projects);
      return project;
    },

    async saveShowroomForm(projectId, form) {
      const projects = await readAll();
      const project = requireProject(projects[projectId]);
      const round1 = normalizeRound1Form(form);
      projects[projectId] = {
        ...project,
        updatedAt: now().toISOString(),
        round1
      };
      await writeAll(projects);
      return round1;
    },

    async saveSnapshot(projectId, snapshot) {
      const projects = await readAll();
      const project = requireProject(projects[projectId]);
      const updated: Round1Project = {
        ...project,
        updatedAt: now().toISOString(),
        snapshot
      };
      projects[projectId] = updated;
      await writeAll(projects);
      return updated;
    },

    async saveRendering(projectId, rendering) {
      const projects = await readAll();
      const project = requireProject(projects[projectId]);
      const timestamp = now().toISOString();
      const updated: Round1Project = {
        ...project,
        updatedAt: timestamp,
        latestRendering: { ...rendering, createdAt: timestamp }
      };
      projects[projectId] = updated;
      await writeAll(projects);
      return updated;
    },

    async getProject(projectId) {
      const projects = await readAll();
      return projects[projectId] ?? null;
    }
  };
}

function requireProject(project: Round1Project | undefined): Round1Project {
  if (!project) {
    throw new Error("Round 1 project not found");
  }
  return project;
}

// Default singleton used by the API routes. File-backed when `ROUND1_DATA_FILE`
// points at a writable path (e.g. `.data/round1-projects.json` in dev via
// `.env.local`); otherwise in-memory, which keeps tests free of disk writes.
function createDefaultRound1Repository(): Round1Repository {
  const dataFile = process.env.ROUND1_DATA_FILE;
  return dataFile
    ? createFileSystemRound1Repository({ filePath: dataFile })
    : createInMemoryRound1Repository();
}

export const round1Repository = createDefaultRound1Repository();
