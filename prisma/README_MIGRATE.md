# Prisma migration notes (Postgres)

This project was switched to use PostgreSQL as the Prisma datasource. Follow these steps to create migrations locally and deploy them to Railway.

## Local migration (developer machine)
1. Ensure `DATABASE_URL` points to a local Postgres instance (or a dev Postgres container).

Example local `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/who_u_dev?schema=public
```

2. Install deps and create migration:
```bash
npm ci
npx prisma generate
npx prisma migrate dev --name init
```

3. Verify the database and commit the generated `prisma/migrations` folder:
```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "prisma: init postgres migrations"
git push
```

## Deploy migrations on Railway (production)
After pushing to Railway and setting `DATABASE_URL` in Railway env vars, run:
```bash
# from project root (Railway console or CI)
npx prisma migrate deploy
npx prisma generate
```

You can add the above as a release command in Railway so migrations run automatically on deploy.

## If you don't have Postgres yet
- Use Railway to create a Postgres plugin and copy the connection string into Railway and/or your local `.env`.
- Alternatively run Postgres locally (Docker):
```bash
docker run --name whou-postgres -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=user -e POSTGRES_DB=who_u_dev -p 5432:5432 -d postgres:15
```

## Notes
- Do not use SQLite in production on Railway; it's ephemeral.
- If you prefer to skip migrations for quick testing, use `npx prisma db push`, but migrations are recommended for production.
