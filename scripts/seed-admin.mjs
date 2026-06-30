import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;

const email = process.env.SEED_ADMIN_EMAIL;
const account = process.env.SEED_ADMIN_ACCOUNT || email?.split("@")[0];
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME || "Admin";
const companyName = process.env.SEED_COMPANY_NAME || "ABC Cabinet";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!email) throw new Error("SEED_ADMIN_EMAIL is required");
if (!account) throw new Error("SEED_ADMIN_ACCOUNT is required");
if (!password) throw new Error("SEED_ADMIN_PASSWORD is required");

const salt = randomBytes(16).toString("hex");
const key = await scrypt(password, salt, 64);
const passwordHash = `scrypt:${salt}:${Buffer.from(key).toString("hex")}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Idempotent company: reuse the company by name if it already exists, so
// re-running (e.g. as a permanent Railway pre-deploy command) never creates
// duplicate companies.
const existingCompany = await pool.query(
  `SELECT id FROM companies WHERE name = $1 ORDER BY created_at LIMIT 1`,
  [companyName]
);
const companyId =
  existingCompany.rows[0]?.id ??
  (await pool.query(`INSERT INTO companies (name) VALUES ($1) RETURNING id`, [companyName]))
    .rows[0].id;

// Idempotent admin: upsert so a re-run refreshes the password/name, but NEVER
// downgrade an OWNER. This seed runs on every deploy; without the role guard it
// would reset a promoted owner (same email) back to ADMIN each time, silently
// locking owner-only features (role changes, cabinet colors) until re-promoted.
const result = await pool.query(
  `INSERT INTO users (company_id, account, email, name, password_hash, role)
   VALUES ($1, $2, $3, $4, $5, 'ADMIN')
   ON CONFLICT (email) DO UPDATE SET
     account = EXCLUDED.account,
     name = EXCLUDED.name,
     password_hash = EXCLUDED.password_hash,
     role = CASE WHEN users.role = 'OWNER' THEN 'OWNER' ELSE EXCLUDED.role END
   RETURNING (xmax = 0) AS inserted`,
  [companyId, account, email, name, passwordHash]
);

await pool.end();
console.log(`${result.rows[0].inserted ? "Created" : "Updated"} admin ${account}`);
