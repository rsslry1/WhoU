# Deploying to Railway

This guide shows the minimal steps and env-vars to deploy this Next.js + Prisma app to Railway.

## Prerequisites
- A Railway account (https://railway.app).
- The project connected to a GitHub repo or push via the Railway CLI.
- Move off SQLite to PostgreSQL for production (Railway provides Postgres).

## Railway: quick steps
1. Create a new project in Railway and connect your GitHub repo (or use `railway up`).
2. Add a PostgreSQL plugin/service in Railway; copy the provided connection string.
3. In your Railway Project Settings → Variables, add the following env vars:
   - `DATABASE_URL` = `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`
   - `NEXTAUTH_URL` = `https://<your-service>.up.railway.app` (if using `next-auth`)
   - `NEXTAUTH_SECRET` = `<random-secret>`
   - Any other keys your app needs (e.g., `OPENAI_API_KEY`, `NEXT_PUBLIC_*`)

Railway sets `PORT` automatically; `next start` respects it.

## Build & Start commands (Railway settings)
- Build command:
```bash
npm ci && npm run build
```
- Start command:
```bash
npm run start
```

These use the scripts in `package.json` (`build: next build`, `start: next start`).

## Prisma: switch to Postgres and migrate
1. Update `prisma/schema.prisma`: change the datasource provider to `postgresql`.

Example datasource block:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Locally (before pushing), create migrations and generate client:
```bash
# install deps
npm ci
# create migration and apply locally
npx prisma migrate dev --name init
# generate client
npx prisma generate
```
Commit the `prisma/migrations` folder and pushed changes.

3. On Railway (production), run migrations after the DB is available:
```bash
npx prisma migrate deploy
npx prisma generate
```
You can run these manually in the Railway console, or add them as a release command.

Release command example (Railway release hook):
```bash
npx prisma migrate deploy && npx prisma generate
```

If you prefer not to use migrations, `npx prisma db push` can sync schema without migration history (not recommended for complex schemas).

## Notes & gotchas
- SQLite is ephemeral on Railway and not suitable for production — switch to Postgres.
- `next.config.ts` already sets `output: "standalone"`, which is good for production builds.
- If you use OAuth (`next-auth`), set callback URLs in the provider configs to your Railway domain.
- For file uploads, add external storage (S3, Cloudflare R2, etc.).

## Local test commands
```bash
# run dev
npm run dev
# build
npm run build
# start locally (after build)
npm run start
```

## Want me to patch Prisma now?
Reply `YES` to have me change `prisma/schema.prisma` to `postgresql` and scaffold a local migration commit, or `NO` to keep the repository unchanged.
