import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | null = null;

// TLS for the connection to the (remote) database. The production DB is reached
// over a public TCP proxy, so traffic — password hashes, session ids — must be
// encrypted. We require TLS in production unless the URL already carries an
// explicit `sslmode`. `DATABASE_SSL_NO_VERIFY=true` relaxes certificate
// verification for providers that present self-signed proxy certs (e.g. Railway)
// while still encrypting the wire.
// ponytail: env-driven on/off rather than a config object — upgrade to a pinned
// CA bundle (`ssl: { ca }`) if you need full chain verification.
export function resolveSsl(connectionString: string): PoolConfig["ssl"] {
  if (/[?&]sslmode=/.test(connectionString)) return undefined; // the URL drives it
  if (process.env.NODE_ENV !== "production") return undefined; // local dev DBs are plaintext
  return { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== "true" };
}

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({
      connectionString,
      ssl: resolveSsl(connectionString),
      // The DB is a remote Railway proxy: cold connects cost ~1.2s and each
      // round trip ~250ms. Keep connections warm so sporadic navigation reuses
      // an open socket instead of re-handshaking on every click.
      max: 10,
      idleTimeoutMillis: 60_000,
      keepAlive: true,
      // Fail fast instead of hanging a request forever on an unreachable DB or a
      // runaway query holding one of the 10 pooled connections.
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000
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
