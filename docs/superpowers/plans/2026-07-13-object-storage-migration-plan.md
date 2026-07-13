# Object Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move rendering and cabinet-color images from PostgreSQL Base64/text fields to a Railway S3-compatible Bucket with backward-compatible reads and an idempotent migration path.

**Architecture:** Add a server-only S3 storage adapter using the AWS SDK. New writes upload image bytes and store deterministic object keys in nullable PostgreSQL columns. Reads prefer Bucket objects and fall back to legacy fields until migration verification is complete. Existing image API contracts remain unchanged.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL, `pg`, Railway Storage Bucket, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, Vitest, Sharp.

## Global Constraints

- Do not delete existing Base64 or inline-image columns until migration verification succeeds.
- Do not expose Bucket credentials to browser code.
- Do not change project authorization behavior.
- Migration scripts must be idempotent and use deterministic object keys.
- Preserve unrelated uncommitted changes in the working tree.
- Run focused tests before the full test suite.

### Task 1: Add the storage dependency and server-only adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/server/storage/bucket.ts`
- Create: `src/server/storage/bucket.test.ts`

**Interfaces:**
- Produces `uploadObject(key, body, contentType): Promise<void>`.
- Produces `getObject(key): Promise<{ body: Buffer; contentType: string | undefined }>`.
- Produces `deleteObject(key): Promise<void>`.
- Produces `buildObjectKey(prefix, ...parts): string`.

- [ ] Write tests for deterministic key generation, missing environment configuration, upload metadata, and download buffer conversion.
- [ ] Run `npx vitest run src/server/storage/bucket.test.ts` and verify the new tests fail because the adapter is missing.
- [ ] Install `@aws-sdk/client-s3` and implement the adapter with `region`, `endpoint`, `accessKeyId`, `secretAccessKey`, and `bucket` loaded only on the server.
- [ ] Run the focused storage tests and verify they pass.

### Task 2: Add additive database columns

**Files:**
- Modify: `src/server/db/schema.sql`
- Modify: `src/server/db/schema.test.ts`

**Interfaces:**
- `renderings` gains nullable `image_object_key`, `image_content_type`, and `image_bytes`.
- `cabinet_colors` gains nullable `swatch_object_key` and `hover_object_key`.

- [ ] Add failing schema assertions for all five columns.
- [ ] Run `npx vitest run src/server/db/schema.test.ts` and verify the assertions fail.
- [ ] Add idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements without removing legacy columns.
- [ ] Run the schema test and verify it passes.

### Task 3: Make rendering writes and image reads Bucket-aware

**Files:**
- Modify: `src/server/platform/round1-postgres-repository.ts`
- Modify: `src/server/platform/round1-postgres-repository.test.ts`
- Inspect/modify: `src/app/api/projects/[projectId]/round1/renderings/[renderingId]/image/route.ts`

**Interfaces:**
- `saveRenderingHistory` uploads `rendering.imageBase64` as bytes, stores a deterministic key, and keeps the legacy field populated only during compatibility rollout if required by existing return types.
- `getRenderingImage` prefers `image_object_key`; if absent, it decodes `image_base64` exactly as it does today.

- [ ] Add tests proving object storage is preferred and legacy Base64 is used when no object key exists.
- [ ] Run `npx vitest run src/server/platform/round1-postgres-repository.test.ts` and verify the new tests fail.
- [ ] Implement upload-before-insert with a deterministic key based on project ID and generated rendering ID; use a generated ID before the insert so the key is known.
- [ ] Update the image route response to use stored content type when available and preserve authorization checks.
- [ ] Run the focused repository and route tests and verify they pass.

### Task 4: Make cabinet-color writes and reads Bucket-aware

**Files:**
- Modify: `src/server/platform/cabinet-color-repository.ts`
- Modify: `src/server/platform/cabinet-color-repository.test.ts`

**Interfaces:**
- New or updated inline data URLs are decoded and uploaded to deterministic `cabinet-colors/{colorId}/swatch.webp` and `cabinet-colors/{colorId}/hover.webp` keys.
- `getCabinetColor` and list methods prefer object-backed image URLs or proxy paths while falling back to legacy inline values during rollout.

- [ ] Add tests for new object-key persistence and legacy inline-image fallback.
- [ ] Run `npx vitest run src/server/platform/cabinet-color-repository.test.ts` and verify the new tests fail.
- [ ] Implement the minimal repository changes while preserving the existing color input validation.
- [ ] Run the focused cabinet-color tests and verify they pass.

### Task 5: Add an idempotent existing-data migration script

**Files:**
- Create: `scripts/migrate-images-to-bucket.mjs`
- Modify: `package.json`
- Create: `scripts/migrate-images-to-bucket.test.mjs` or a testable helper under `src/server/storage/`

**Interfaces:**
- Command: `npm run db:migrate-images-to-bucket`.
- The command selects only rows missing their object key, uploads deterministic objects, and updates the database after a successful upload.
- The command never deletes source columns or source data.

- [ ] Add tests for retry behavior: a row with an existing key is skipped, a failed upload leaves the row unmigrated, and a successful upload updates the row.
- [ ] Run the focused migration tests and verify they fail.
- [ ] Implement the script using the existing `DATABASE_URL`/TLS conventions from `scripts/migrate.mjs` and server-only Bucket credentials.
- [ ] Add progress output that reports counts but never prints credentials or image data.
- [ ] Run the migration tests and verify they pass.

### Task 6: Add cleanup and operational verification tooling

**Files:**
- Create: `scripts/report-image-storage.mjs`
- Modify: `package.json`
- Create: `src/server/storage/image-retention.test.ts`

**Interfaces:**
- Command: `npm run db:report-image-storage` prints database image counts, migrated counts, and candidate unreferenced renderings.
- Retention selection preserves every `design_basis.rendering_id` and the five newest unreferenced renderings per project.

- [ ] Add tests for retention selection that preserve locked renderings and keep the newest five unreferenced rows.
- [ ] Run the focused retention tests and verify they fail.
- [ ] Implement report-only behavior; do not delete production data automatically.
- [ ] Run the focused tests and verify they pass.

### Task 7: Migrate, verify, and reclaim PostgreSQL space

**Files:**
- No source changes; execute controlled deployment/database operations.

- [ ] Create a Railway Bucket and inject its server-side credentials into the application service.
- [ ] Deploy the compatibility version and verify new rendering writes and old image reads.
- [ ] Run `npm run db:migrate-images-to-bucket` against production.
- [ ] Verify rendering and cabinet-color migrated counts are complete and fetch representative images through the production API.
- [ ] Create a Railway Volume backup before destructive schema cleanup.
- [ ] Drop legacy image columns in a maintenance window only after verification.
- [ ] Run `VACUUM (FULL, ANALYZE) renderings` and `VACUUM (FULL, ANALYZE) cabinet_colors` with sufficient free space.
- [ ] Run `npm run db:report-image-storage` and record the final PostgreSQL size and Railway Volume usage.

## Verification commands

```bash
npx vitest run src/server/storage src/server/db/schema.test.ts src/server/platform/round1-postgres-repository.test.ts src/server/platform/cabinet-color-repository.test.ts
npm test
npm run build
git diff --check
```

