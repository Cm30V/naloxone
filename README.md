# Georgia Naloxone / Fentanyl Test Strip Locator (prototype)

Mobile-and-desktop web app to find nearby Georgia naloxone distribution boxes and submit new ones. Built with Next.js (App Router), TypeScript, and Tailwind CSS for Vercel.

This is a **prototype**, not a production harm-reduction service.

## Datastore

- **Location records:** [Neon Postgres](https://neon.tech) via the Vercel Marketplace (`@neondatabase/serverless` + Drizzle). This replaces sunset **Vercel Postgres**.
- **Uploaded photos:** [Vercel Blob](https://vercel.com/docs/vercel-blob). Do not store images as base64 in the database.
- The CSV `georgia_naloxone_access_points.csv` is **seed data only**. Vercel’s filesystem is read-only at runtime, so new submissions are never written back to the CSV.

CSV columns (confirmed from the file): `name`, `description`, `latitude`, `longitude`, `24/7`, `naloxone`, `fent_strips`, `type`, `image_url`. They map to `is_24_7`, `has_naloxone`, `has_fent_strips`, and `image_urls[]` in Postgres.

## One-time setup

1. Install the Vercel CLI and log in (`npx vercel login`).
2. From this directory: `npx vercel link`.
3. Provision Neon and connect it to the project:

   ```bash
   npx vercel integration add neon --yes --no-claim
   ```

   If the CLI needs a browser to accept terms or finish the install, complete that step, then continue.
4. Create a Blob store and connect it to the project:

   ```bash
   npx vercel blob store add
   ```

5. Pull env vars locally:

   ```bash
   npx vercel env pull .env.local --yes
   ```

6. Push schema and seed from the CSV:

   ```bash
   npm install
   npm run db:push
   npm run db:seed
   ```

7. Run the app: `npm run dev`.

Required environment variables are listed in `.env.example`:

- `DATABASE_URL` — Neon connection string
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob write token

## Deploy

```bash
npx vercel deploy
```

After the first production deploy, run `db:push` and `db:seed` against the **production** `DATABASE_URL` as well (or use Neon’s SQL editor) so production is not an empty table.

## API

- `GET /api/locations` — all **approved** locations (seeded + user-submitted).
- `POST /api/locations` — multipart form: `name`, `description`, `latitude`, `longitude`, `is_24_7`, `has_naloxone`, `has_fent_strips`, `type`, and one optional `images` file. Images go to Blob; the row is stored in Neon.

## Moderation (must revisit before a real launch)

User-submitted boxes are **auto-approved** so they show up immediately in Find a box. That is the simplest prototype behavior. Before any public launch, add review: bad actors could submit fake or harmful coordinates. There is **no admin dashboard** yet — that is a next step, along with accounts/auth.

## Out of scope

- User authentication
- Admin moderation UI
- In-app turn-by-turn routing (the app hands off to Apple Maps on iOS and Google Maps otherwise)
