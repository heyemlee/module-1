import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME || "Admin";
const companyName = process.env.SEED_COMPANY_NAME || "ABC Cabinet";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!email) throw new Error("SEED_ADMIN_EMAIL is required");
if (!password) throw new Error("SEED_ADMIN_PASSWORD is required");

const salt = randomBytes(16).toString("hex");
const key = await scrypt(password, salt, 64);
const passwordHash = `scrypt:${salt}:${Buffer.from(key).toString("hex")}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const company = await pool.query(
  `INSERT INTO companies (name)
   VALUES ($1)
   RETURNING id`,
  [companyName]
);

await pool.query(
  `INSERT INTO users (company_id, email, name, password_hash, role)
   VALUES ($1, $2, $3, $4, 'ADMIN')
   ON CONFLICT (email) DO NOTHING`,
  [company.rows[0].id, email, name, passwordHash]
);

await pool.end();
console.log(`Seeded admin ${email}`);
