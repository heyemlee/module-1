import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;

const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;
const name = process.env.SEED_USER_NAME || "User";
const role = (process.env.SEED_USER_ROLE || "SALES").toUpperCase();
// Optional: attach to a specific company by name; otherwise the oldest company.
const companyName = process.env.SEED_COMPANY_NAME;

const VALID_ROLES = ["ADMIN", "SALES", "DESIGNER"];

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!email) throw new Error("SEED_USER_EMAIL is required");
if (!password) throw new Error("SEED_USER_PASSWORD is required");
if (!VALID_ROLES.includes(role)) {
  throw new Error(`SEED_USER_ROLE must be one of ${VALID_ROLES.join(", ")}`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// New users join an existing company so role-visibility tests share one tenant.
const company = companyName
  ? await pool.query(
      `SELECT id FROM companies WHERE name = $1 ORDER BY created_at LIMIT 1`,
      [companyName]
    )
  : await pool.query(`SELECT id FROM companies ORDER BY created_at LIMIT 1`);

if (company.rowCount === 0) {
  await pool.end();
  throw new Error(
    companyName
      ? `No company named "${companyName}" found. Run db:seed-admin first.`
      : "No company found. Run db:seed-admin first to create the company and first admin."
  );
}

const salt = randomBytes(16).toString("hex");
const key = await scrypt(password, salt, 64);
const passwordHash = `scrypt:${salt}:${Buffer.from(key).toString("hex")}`;

// Idempotent: re-running with the same email updates the password/name/role,
// so a typo'd password can be fixed without manual SQL.
const result = await pool.query(
  `INSERT INTO users (company_id, email, name, password_hash, role)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (email) DO UPDATE SET
     name = EXCLUDED.name,
     password_hash = EXCLUDED.password_hash,
     role = EXCLUDED.role
   RETURNING (xmax = 0) AS inserted`,
  [company.rows[0].id, email, name, passwordHash, role]
);

await pool.end();
console.log(`${result.rows[0].inserted ? "Created" : "Updated"} ${role} user ${email}`);
