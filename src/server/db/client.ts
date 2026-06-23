import { Pool, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({
      connectionString,
      // The DB is a remote Railway proxy: cold connects cost ~1.2s and each
      // round trip ~250ms. Keep connections warm so sporadic navigation reuses
      // an open socket instead of re-handshaking on every click.
      max: 10,
      idleTimeoutMillis: 60_000,
      keepAlive: true
    });
    // A dropped backend connection should not crash the server process.
    pool.on("error", (error) => {
      console.error("Postgres pool error", error);
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}
