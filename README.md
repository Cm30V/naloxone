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
   npm run db:migrate
   npm run db:seed
   ```

7. Run the app: `npm run dev`.

Required environment variables are listed in `.env.example`:

- `DATABASE_URL` — Neon connection string
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob write token
- `ADMIN_PASSWORD_HASH` — server-only scrypt hash of the admin access code
- `ADMIN_SESSION_SECRET` — random server-only secret of at least 32 characters
- `RATE_LIMIT_SECRET` — optional separate HMAC secret; defaults to
  `ADMIN_SESSION_SECRET`

Never prefix these variables with `NEXT_PUBLIC_`. Create the password hash
locally without saving the plaintext password in a file:

```bash
read -s "ADMIN_PASSWORD?Admin access code: "; export ADMIN_PASSWORD; echo
node -e 'const c=require("node:crypto"),s=c.randomBytes(16),h=c.scryptSync(process.env.ADMIN_PASSWORD,s,64);console.log(`scrypt:${s.toString("base64url")}:${h.toString("base64url")}`)'
unset ADMIN_PASSWORD
```

Save the printed hash as `ADMIN_PASSWORD_HASH` in `.env.local` and as a
Vercel **Secret**. Generate `ADMIN_SESSION_SECRET` with
`openssl rand -base64 48` and save it in both places as well. Add the Vercel
Secrets to Production, Preview, and Development. Vercel Secrets cannot be
pulled back down later, so retain the local values securely; `.env.local` is
gitignored.

## Deploy

```bash
npx vercel deploy
```

After the first production deploy, run `db:migrate` and `db:seed` against the
**production** `DATABASE_URL` as well (or use Neon’s SQL editor) so production
has the required tables and seed locations. The migration is idempotent and
does not remove existing records.

## API

- `GET /api/locations` — all **approved** locations (seeded + user-submitted).
- `POST /api/locations` — validates and stores a new **pending** location,
  private contact phone/email, and one optional image.
- `POST /api/locations/:id/reports` — stores a supply-used or restock report
  for an approved location.
- `/api/admin/*` — authenticated dashboard, moderation, and report-management
  endpoints. Every protected operation verifies the signed server session.

## Moderation and security

User-submitted boxes remain **pending** until an administrator approves them.
Contact details are returned only by an authenticated admin endpoint and are
never included in the public location DTO. Public submissions, supply reports,
and admin login attempts have database-backed rate limits. Supply reports use
idempotency keys plus a one-way, server-keyed request-source identifier and a
per-location/report-type daily uniqueness constraint. Raw IP addresses are not
stored.

This remains a prototype. Before a real-world launch, replace the shared admin
code with individual administrator accounts and MFA, add audit logs and alerting,
define data-retention rules for contact details and rate-limit records, and
arrange regular dependency and penetration testing.

## Out of scope

- Public user authentication/accounts
- In-app turn-by-turn routing (the app hands off to Apple Maps on iOS and Google Maps otherwise)
