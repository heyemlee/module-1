# Railway Internal Platform Deployment

## Services

- Next.js Web Service
- Railway Postgres

## Required Variables

```text
DATABASE_URL=provided by Railway Postgres
OPENAI_API_KEY=company OpenAI key
OPENAI_IMAGE_MODEL=gpt-image-2
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
SEED_COMPANY_NAME=ABC Cabinet
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=replace-with-a-strong-password
SEED_ADMIN_NAME=Admin
```

## First Deploy

```bash
npm run db:migrate
npm run db:seed-admin
npm run build
npm start
```

## Boundaries

- Production uses `DATABASE_URL`, not `ROUND1_DATA_FILE`.
- AI keys stay in Railway Variables for this release.
- Sales users do not enter API keys.
- Round 1 remains sales-estimate-only and not for production.
