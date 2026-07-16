CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account TEXT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'SALES', 'DESIGNER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  monthly_render_quota INTEGER NOT NULL DEFAULT 50
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS account TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_render_quota INTEGER NOT NULL DEFAULT 50;
-- Soft-delete column. The code (findUserForLogin, listCompanyUsers, deleteUser)
-- filters on deleted_at, so a fresh DB without it 500s on login. Idempotent add.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
UPDATE users
SET account = lower(replace(email, '@', '_'))
WHERE account IS NULL;
ALTER TABLE users ALTER COLUMN account SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_account_lower_key ON users (lower(account));

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'INTAKE',
      'RENDERING_READY',
      'ROUND2_MEASURING',
      'ARCHIVED'
    )
  ) DEFAULT 'INTAKE',
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  assigned_designer_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS round1_states (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  showroom_form_json JSONB NOT NULL,
  position_overrides_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  fixed_positions_confirmed BOOLEAN NOT NULL DEFAULT false,
  cabinet_fill_generated BOOLEAN NOT NULL DEFAULT false,
  current_step INTEGER NOT NULL DEFAULT 0,
  max_accessible_step INTEGER NOT NULL DEFAULT 0,
  updated_by_user_id UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE round1_states ADD COLUMN IF NOT EXISTS current_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE round1_states ADD COLUMN IF NOT EXISTS max_accessible_step INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS round1_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  generated_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS renderings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  round1_snapshot_id UUID NOT NULL REFERENCES round1_snapshots(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  image_object_key TEXT,
  image_content_type TEXT,
  image_bytes INTEGER,
  prompt TEXT NOT NULL,
  size TEXT NOT NULL,
  based_on_snapshot_generated_at TIMESTAMPTZ NOT NULL,
  based_on_cabinet_style TEXT CHECK (based_on_cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED')),
  based_on_door_color_id UUID,
  based_on_color_updated_at TIMESTAMPTZ,
  sales_estimate_only BOOLEAN NOT NULL CHECK (sales_estimate_only = true),
  not_for_production BOOLEAN NOT NULL CHECK (not_for_production = true),
  dimension_confidence TEXT NOT NULL CHECK (dimension_confidence = 'ROUGH'),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE renderings ADD COLUMN IF NOT EXISTS based_on_cabinet_style TEXT CHECK (based_on_cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED'));
ALTER TABLE renderings ADD COLUMN IF NOT EXISTS based_on_door_color_id UUID;
ALTER TABLE renderings ADD COLUMN IF NOT EXISTS based_on_color_updated_at TIMESTAMPTZ;
ALTER TABLE renderings ADD COLUMN IF NOT EXISTS image_object_key TEXT;
ALTER TABLE renderings ADD COLUMN IF NOT EXISTS image_content_type TEXT;
ALTER TABLE renderings ADD COLUMN IF NOT EXISTS image_bytes INTEGER;

CREATE TABLE IF NOT EXISTS cabinet_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cabinet_style TEXT NOT NULL CHECK (cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED')),
  name TEXT NOT NULL,
  color_code TEXT,
  swatch_image_url TEXT,
  swatch_hex TEXT,
  hover_example_image_url TEXT,
  prompt_description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_company_name_idx ON customers(company_id, name);
CREATE INDEX IF NOT EXISTS projects_company_status_idx ON projects(company_id, status);
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects(created_by_user_id);
CREATE INDEX IF NOT EXISTS renderings_project_created_idx ON renderings(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cabinet_colors_company_style_idx ON cabinet_colors(company_id, cabinet_style, active, sort_order);

-- Migration (2026-06-24): collapse project statuses into 4 stages
-- (INTAKE, RENDERING_READY, ROUND2_MEASURING, ARCHIVED). Idempotent: safe to
-- re-run, and a no-op once existing rows/constraints are already migrated.
-- Order matters: drop the old CHECK first, otherwise the still-active old
-- constraint rejects the new values during the UPDATEs below.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

UPDATE projects SET status = 'INTAKE'
  WHERE status IN ('DRAFT', 'ROUND1_SNAPSHOT_READY', 'NEEDS_CONFIRMATION');
UPDATE projects SET status = 'RENDERING_READY'
  WHERE status = 'ROUND1_RENDERING_READY';
UPDATE projects SET status = 'ROUND2_MEASURING'
  WHERE status = 'ROUND2_READY';

ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (
  status IN ('INTAKE', 'RENDERING_READY', 'ROUND2_MEASURING', 'ARCHIVED')
);
ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'INTAKE';

-- Migration (2026-06-29): add OWNER role above ADMIN. Idempotent: drop the old
-- CHECK first so it can't reject the new value, then re-add it with OWNER.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('OWNER', 'ADMIN', 'SALES', 'DESIGNER'));

-- Migration (2026-07-08): design basis — the customer-confirmed Round 1 package
-- (one rendering + the snapshot/style/color it was generated from) that
-- technical design (Round 2) reads. Append-only: relocking inserts version+1;
-- the current basis is the row with the highest version per project.
CREATE TABLE IF NOT EXISTS design_basis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  rendering_id UUID NOT NULL REFERENCES renderings(id) ON DELETE CASCADE,
  round1_snapshot_id UUID NOT NULL REFERENCES round1_snapshots(id) ON DELETE CASCADE,
  cabinet_style TEXT NOT NULL CHECK (cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED')),
  door_color_id UUID NOT NULL,
  locked_by_user_id UUID NOT NULL REFERENCES users(id),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS design_basis_project_version_idx
  ON design_basis(project_id, version DESC);
