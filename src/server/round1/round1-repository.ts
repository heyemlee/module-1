import {
  normalizeRound1Form,
  type Round1FormInput,
  type Round1NormalizationResult
} from "@/domain/round1";

export type Round1Project = {
  id: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  round1?: Round1NormalizationResult;
};

export type Round1Repository = {
  createProject(input: { customerName: string }): Promise<Round1Project>;
  saveShowroomForm(
    projectId: string,
    form: Round1FormInput
  ): Promise<Round1NormalizationResult>;
  getProject(projectId: string): Promise<Round1Project | null>;
};

export function createInMemoryRound1Repository(options: {
  createId?: () => string;
  now?: () => Date;
} = {}): Round1Repository {
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
      const project = projects.get(projectId);
      if (!project) {
        throw new Error("Round 1 project not found");
      }

      const round1 = normalizeRound1Form(form);
      const updated = {
        ...project,
        updatedAt: now().toISOString(),
        round1
      };
      projects.set(projectId, updated);
      return round1;
    },

    async getProject(projectId) {
      return projects.get(projectId) ?? null;
    }
  };
}

export const round1Repository = createInMemoryRound1Repository();
