import { Pool, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}
