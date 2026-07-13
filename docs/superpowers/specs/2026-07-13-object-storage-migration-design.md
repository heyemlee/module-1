# Object Storage Migration Design

## Goal

Move generated rendering images and cabinet-color images out of PostgreSQL and into a Railway S3-compatible Storage Bucket, while keeping existing image URLs working during a safe, resumable migration.

## Context

The production PostgreSQL Volume was expanded from 500MB to 1GB. Read-only inspection found that PostgreSQL stores approximately 121MB of rendering image Base64 data and 74MB of inline cabinet-color image data. The database currently stores rendering images in `renderings.image_base64` and cabinet-color images in `cabinet_colors.swatch_image_url` and `cabinet_colors.hover_example_image_url`.

## Recommended architecture

Railway Bucket stores binary image objects. PostgreSQL stores object metadata and keys only.

Object key layout:

```text
renderings/{projectId}/{renderingId}.webp
cabinet-colors/{colorId}/swatch.webp
cabinet-colors/{colorId}/hover.webp
```

The existing rendering image API remains the browser-facing contract. It authenticates and authorizes the request, then streams the object from the private Bucket. This avoids exposing Bucket credentials and avoids requiring a frontend route change.

## Compatibility and rollout

The rollout is additive and backward compatible:

1. Add nullable object-key and image metadata columns.
2. Add a storage adapter for upload, download, and delete operations.
3. Change new rendering and cabinet-color writes to upload to the Bucket and store only object keys.
4. Change reads to prefer object storage and fall back to the legacy Base64/inline image fields.
5. Run an idempotent migration script for existing rows. Each row is uploaded before its database key is updated.
6. Verify migrated counts and sample image retrieval.
7. Remove legacy image columns only after verification and a Railway backup.
8. Run a controlled `VACUUM FULL` during a maintenance window to return reclaimed space to the Volume.

If an upload succeeds but the database update fails, the migration can be rerun safely because the object key is deterministic. If the database update succeeds but a later read fails, the legacy field remains available until the final cleanup migration.

## Data model

Add the following nullable columns:

```sql
ALTER TABLE renderings
  ADD COLUMN IF NOT EXISTS image_object_key TEXT,
  ADD COLUMN IF NOT EXISTS image_content_type TEXT,
  ADD COLUMN IF NOT EXISTS image_bytes INTEGER;

ALTER TABLE cabinet_colors
  ADD COLUMN IF NOT EXISTS swatch_object_key TEXT,
  ADD COLUMN IF NOT EXISTS hover_object_key TEXT;
```

Legacy image columns remain until the migration is verified. The final cleanup removes them and makes the object-key columns required only after all existing rows have been migrated.

## Image processing

New generated rendering images should be normalized to WebP where practical. The storage layer must accept the current PNG/JPEG bytes during migration and should record the actual content type. Existing images should be migrated without lossy re-encoding unless an explicit image optimization step is added; correctness takes priority during the first migration.

## Error handling

- A failed Bucket upload must fail the write and must not create a database row that claims the image exists.
- A failed database update after an upload must surface an error and leave the deterministic object available for a retry or cleanup operation.
- Image reads should return the legacy image when an object key is absent.
- Missing objects must produce the existing not-found behavior, not leak Bucket credentials or unrelated project data.
- Bucket credentials must be read only from server-side environment variables.

## Retention policy

After migration, add a separate cleanup operation rather than deleting during the storage migration. Candidate cleanup rows are renderings not referenced by `design_basis` and older than the configured retention window. The first policy should retain every locked rendering and the five newest unreferenced renderings per project. Test data can be deleted explicitly after review.

## Verification

Automated tests will cover:

- object-key generation;
- upload metadata and failure propagation;
- rendering reads preferring object storage and falling back to legacy Base64;
- cabinet-color reads preferring object keys and falling back to legacy inline images;
- migration idempotency and no deletion before verification.

Operational verification will check:

```sql
SELECT count(*) AS total,
       count(image_object_key) AS migrated,
       count(*) FILTER (WHERE image_object_key IS NULL) AS remaining
FROM renderings;
```

The same check will be run for both cabinet-color object-key columns. A sample of migrated rendering and cabinet-color images will be fetched through the production API before legacy columns are removed.

## Out of scope

- Changing authentication or project authorization.
- Replacing the existing rendering API contract.
- Introducing a CDN before the storage migration is complete.
- Deleting production data automatically.
- Changing PostgreSQL WAL or autovacuum settings.
