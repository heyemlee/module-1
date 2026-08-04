import { query } from "@/server/db/client";
import type { AuthUser, ProjectStatus, UserRole } from "./types";

export type ProjectAccessRecord = {
  companyId: string;
  createdByUserId: string;
};

export type ProjectSummary = {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  projectName: string;
  status: ProjectStatus;
  createdByUserId: string;
  // Who the project belongs to. SALES only ever sees its own rows, so this is
  // carried for the admin-side list, where "whose project is this" is the
  // question the creator id alone cannot answer.
  createdByName: string | null;
  createdByRole: UserRole | null;
  assignedDesignerId: string | null;
  updatedAt: string;
};

type ProjectRow = {
  id: string;
  company_id: string;
  customer_id: string;
  customer_name: string;
  project_name: string;
  status: ProjectStatus;
  created_by_user_id: string;
  created_by_name: string | null;
  created_by_role: UserRole | null;
  assigned_designer_id: string | null;
  updated_at: Date;
};

// LEFT JOIN, not JOIN: a project whose creator row went missing must still be
// listed. Dropping it would hide work from the very roles that see everything.
const CREATOR_JOIN =
  "LEFT JOIN users AS creator ON creator.id = projects.created_by_user_id";

function mapProject(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    projectName: row.project_name,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name ?? null,
    createdByRole: row.created_by_role ?? null,
    assignedDesignerId: row.assigned_designer_id,
    updatedAt: row.updated_at.toISOString()
  };
}

export function canAccessProject(user: AuthUser, project: ProjectAccessRecord) {
  if (user.companyId !== project.companyId) return false;
  if (user.role === "ADMIN" || user.role === "DESIGNER" || user.role === "OWNER") return true;
  return project.createdByUserId === user.id;
}

export function projectListWhereClause(user: AuthUser) {
  if (user.role === "SALES") {
    return {
      text: "projects.company_id = $1 AND projects.created_by_user_id = $2",
      values: [user.companyId, user.id]
    };
  }
  return {
    text: "projects.company_id = $1",
    values: [user.companyId]
  };
}

export async function listProjectsForUser(user: AuthUser, search = "") {
  const where = projectListWhereClause(user);
  const values = [...where.values];
  let searchSql = "";
  if (search.trim()) {
    values.push(`%${search.trim()}%`);
    searchSql = ` AND (customers.name ILIKE $${values.length} OR customers.address ILIKE $${values.length} OR projects.name ILIKE $${values.length})`;
  }
  const result = await query<ProjectRow>(
    `SELECT projects.id, projects.company_id, projects.customer_id,
            customers.name AS customer_name, projects.name AS project_name,
            projects.status, projects.created_by_user_id,
            creator.name AS created_by_name, creator.role AS created_by_role,
            projects.assigned_designer_id,
            projects.updated_at
     FROM projects
     JOIN customers ON customers.id = projects.customer_id
     ${CREATOR_JOIN}
     WHERE ${where.text}${searchSql}
     ORDER BY projects.updated_at DESC
     LIMIT 100`,
    values
  );
  return result.rows.map(mapProject);
}

export async function createCustomerProject(input: {
  user: AuthUser;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  projectName: string;
}) {
  const customer = await query<{ id: string }>(
    `INSERT INTO customers (company_id, name, phone, email, address, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.user.companyId,
      input.customerName,
      input.customerPhone ?? null,
      input.customerEmail ?? null,
      input.customerAddress ?? null,
      input.user.id
    ]
  );
  const project = await query<ProjectRow>(
    `INSERT INTO projects (company_id, customer_id, name, created_by_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, company_id, customer_id, $5::text AS customer_name, name AS project_name,
               status, created_by_user_id, $6::text AS created_by_name, $7::text AS created_by_role,
               assigned_designer_id, updated_at`,
    [
      input.user.companyId,
      customer.rows[0].id,
      input.projectName,
      input.user.id,
      input.customerName,
      input.user.name,
      input.user.role
    ]
  );
  return mapProject(project.rows[0]);
}

export async function getProjectForUser(projectId: string, user: AuthUser) {
  const result = await query<ProjectRow>(
    `SELECT projects.id, projects.company_id, projects.customer_id,
            customers.name AS customer_name, projects.name AS project_name,
            projects.status, projects.created_by_user_id,
            creator.name AS created_by_name, creator.role AS created_by_role,
            projects.assigned_designer_id,
            projects.updated_at
     FROM projects
     JOIN customers ON customers.id = projects.customer_id
     ${CREATOR_JOIN}
     WHERE projects.id = $1
     LIMIT 1`,
    [projectId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const project = mapProject(row);
  return canAccessProject(user, project) ? project : null;
}

export async function deleteProjectForUser(projectId: string, user: AuthUser) {
  const result = await query<{ id: string }>(
    `DELETE FROM projects
     WHERE id = $1 AND company_id = $2
     RETURNING id`,
    [projectId, user.companyId]
  );
  return Boolean(result.rows[0]);
}
