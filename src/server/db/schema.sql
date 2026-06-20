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
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SALES', 'DESIGNER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);

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
      'DRAFT',
      'ROUND1_SNAPSHOT_READY',
      'ROUND1_RENDERING_READY',
      'NEEDS_CONFIRMATION',
      'ROUND2_READY',
      'ARCHIVED'
    )
  ) DEFAULT 'DRAFT',
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
  updated_by_user_id UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  image_base64 TEXT NOT NULL,
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
