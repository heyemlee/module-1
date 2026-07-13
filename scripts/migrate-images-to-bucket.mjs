import pg from "pg";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const required = ["BUCKET", "ENDPOINT", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required for image migration`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== "true" },
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000
});

const client = new S3Client({
  region: process.env.REGION ?? "auto",
  endpoint: process.env.ENDPOINT,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
  }
});

function decodeDataUrl(value) {
  const match = value?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;
  return {
    body: Buffer.from(match[2], "base64"),
    contentType: match[1],
    extension: match[1].split("/")[1].replace("jpeg", "jpg")
  };
}

async function upload(key, image) {
  await client.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: key,
    Body: image.body,
    ContentType: image.contentType
  }));
}

async function migrateRenderings() {
  const result = await pool.query(
    `SELECT id, project_id, image_base64
     FROM renderings
     WHERE image_object_key IS NULL AND image_base64 IS NOT NULL
     ORDER BY created_at ASC`
  );
  let migrated = 0;
  for (const row of result.rows) {
    const image = { body: Buffer.from(row.image_base64, "base64"), contentType: "image/png" };
    const key = `renderings/${row.project_id}/${row.id}.png`;
    await upload(key, image);
    await pool.query(
      `UPDATE renderings
       SET image_object_key = $1, image_content_type = $2, image_bytes = $3
       WHERE id = $4 AND image_object_key IS NULL`,
      [key, image.contentType, image.body.length, row.id]
    );
    migrated += 1;
    console.log(`rendering ${migrated}/${result.rows.length}`);
  }
  return { selected: result.rows.length, migrated };
}

async function migrateCabinetColors() {
  const result = await pool.query(
    `SELECT id, swatch_image_url, hover_example_image_url,
            swatch_object_key, hover_object_key
     FROM cabinet_colors
     WHERE swatch_object_key IS NULL OR hover_object_key IS NULL
     ORDER BY created_at ASC`
  );
  let migrated = 0;
  for (const row of result.rows) {
    const updates = [];
    for (const [variant, value, existingKey] of [
      ["swatch", row.swatch_image_url, row.swatch_object_key],
      ["hover", row.hover_example_image_url, row.hover_object_key]
    ]) {
      const image = decodeDataUrl(value);
      if (!image || existingKey) continue;
      const key = `cabinet-colors/${row.id}/${variant}.${image.extension}`;
      await upload(key, image);
      updates.push({ variant, key });
    }
    for (const update of updates) {
      const column = update.variant === "swatch" ? "swatch_object_key" : "hover_object_key";
      await pool.query(
        `UPDATE cabinet_colors SET ${column} = $1 WHERE id = $2 AND ${column} IS NULL`,
        [update.key, row.id]
      );
      migrated += 1;
    }
  }
  return { selected: result.rows.length, migrated };
}

try {
  const renderings = await migrateRenderings();
  const cabinetColors = await migrateCabinetColors();
  console.log(JSON.stringify({ renderings, cabinetColors }));
} finally {
  await pool.end();
}
