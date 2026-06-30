import pg from "pg";

const { Pool } = pg;

// One-time bootstrap: promote an existing user to OWNER (the role above ADMIN
// that can create admins and edit the door-color library). Owners are never
// created through the app, so this script is the only way the first one appears.
// Run `npm run db:migrate` first so the role CHECK constraint already allows OWNER.
//
//   PROMOTE_OWNER_ACCOUNT=<account> npm run db:promote-owner
//   # or: npm run db:promote-owner -- <account>
const account = process.env.PROMOTE_OWNER_ACCOUNT || process.argv[2];

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!account) {
  throw new Error(
    "Set PROMOTE_OWNER_ACCOUNT or pass the account as an argument: " +
      "PROMOTE_OWNER_ACCOUNT=<account> npm run db:promote-owner"
  );
}

// Mirror scripts/migrate.mjs so a prod promote against the Railway proxy uses TLS.
function resolveSsl(connectionString) {
  if (/[?&]sslmode=/.test(connectionString)) return undefined;
  if (process.env.NODE_ENV !== "production" && process.env.DATABASE_SSL_NO_VERIFY !== "true") {
    return undefined;
  }
  return { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== "true" };
}

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: resolveSsl(connectionString) });

const result = await pool.query(
  `UPDATE users
     SET role = 'OWNER', updated_at = now()
   WHERE lower(account) = lower($1) AND deleted_at IS NULL
   RETURNING account, role`,
  [account]
);

await pool.end();

if (result.rowCount === 0) {
  throw new Error(`No active user found with account "${account}".`);
}
console.log(`Promoted ${result.rows[0].account} to ${result.rows[0].role}`);
