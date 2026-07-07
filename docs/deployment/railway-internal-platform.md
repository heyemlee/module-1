# Railway Internal Platform Deployment

## Services

- Next.js Web Service
- Railway Postgres

## Required Variables

```text
DATABASE_URL=provided by Railway Postgres
OPENAI_API_KEY_PRIMARY=first-choice company OpenAI key
OPENAI_BASE_URL_PRIMARY=optional proxy URL for the primary key
OPENAI_API_KEY_SECONDARY=second-choice company OpenAI key
OPENAI_BASE_URL_SECONDARY=optional proxy URL for the secondary key
OPENAI_API_KEY_TERTIARY=third-choice company OpenAI key
OPENAI_BASE_URL_TERTIARY=optional proxy URL for the tertiary key
OPENAI_API_KEY_PRIORITY=PRIMARY,SECONDARY,TERTIARY
OPENAI_IMAGE_MODEL=gpt-image-2
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
SEED_COMPANY_NAME=ABC Cabinet
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=replace-with-a-strong-password
SEED_ADMIN_NAME=Admin
```

## First Deploy (Railway, GitHub-connected)

1. New Project -> Deploy from GitHub repo -> pick the repo/branch. Railway
   auto-detects Next.js and runs `npm install` -> `npm run build` -> `npm start`
   (`next start` binds to Railway's `$PORT` automatically).
2. New -> Database -> Add PostgreSQL.
3. Set the Variables above. `DATABASE_URL` must reference the database with
   `${{Postgres.DATABASE_URL}}` so migrations run over Railway's internal
   network (no SSL config needed; the `pg` client uses a plain connection
   string). Image generation tries the OpenAI keys in `OPENAI_API_KEY_PRIORITY`
   order and automatically falls back to the next configured key when a
   generation request fails. The OpenAI chat agent uses the first configured
   key in the same priority order when `LLM_PROVIDER=openai`. Each key slot can
   use its own `OPENAI_BASE_URL_<SLOT>`; omit a slot's base URL to call the
   official OpenAI API for that slot.
4. Service -> Settings -> Deploy -> Pre-deploy Command:

   ```bash
   npm run db:migrate && npm run db:seed-admin
   ```

   Both scripts are idempotent and safe to run on every deploy:
   - `db:migrate` uses `CREATE TABLE IF NOT EXISTS`.
   - `db:seed-admin` reuses the company by `SEED_COMPANY_NAME` and upserts the
     admin by email, so it never creates duplicate companies or users. A re-run
     refreshes the admin password/name from the current `SEED_ADMIN_*` vars.
5. Deploy, then open the generated domain (Settings -> Networking) and log in
   with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

To add SALES/DESIGNER users, run `db:seed-user` the same way (set
`SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_ROLE`); it attaches to the
existing company and upserts by email.

## Local one-off scripts

The scripts read `process.env` directly and do not load `.env.local`, so pass
`DATABASE_URL` (and the `SEED_*` vars) inline when running them outside Railway,
e.g. `DATABASE_URL=... npm run db:migrate`.

## Boundaries

- Do not set `NODE_ENV=production` manually in Railway: it makes `npm install`
  skip devDependencies, and the type-checked `next build` needs them.
- Production uses `DATABASE_URL`, not `ROUND1_DATA_FILE`.
- AI keys stay in Railway Variables for this release.
- Sales users do not enter API keys.
- Round 1 remains sales-estimate-only and not for production.
