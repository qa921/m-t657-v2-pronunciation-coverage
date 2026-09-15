# Harbor Language (M-T657-V2 Pronunciation Coverage)

Audio-focused language-learning app across Spanish, French, Japanese, and German,
now with learner accounts, Postgres persistence, and an admin console.

## What changed in this release

- **Learner accounts**: email + password registration/login (scrypt-hashed
  passwords, HttpOnly session cookies). Registration always creates a
  `learner`; no public flow can create an admin.
- **Persistence in Postgres (Neon)**: `app_users`, `sessions`,
  `learner_progress`, and `interactions` tables (see `db/schema.sql`). The API
  applies the schema idempotently on cold start. The prior-state contract file
  `data/learner-progress-prior-state.json` is kept for reference; nothing is
  persisted to local files anymore.
- **Admin console** (`/admin.html`, admin-only):
  - Users: search by name/email, filter by role and by has/no progress.
  - Learner detail: profile, per-prompt progress, recent interactions, and
    role management (admin-only, cannot change your own role, the last admin
    cannot be demoted, every change is audit-logged).
  - Interactions: filter by user email, type, prompt id, language, and date
    range, with pagination.
  - Export: admin-only JSON/CSV export at `/api/admin/export`; every export is
    audit-logged.

## Audio contract (unchanged)

`data/audio-manifest.json` is the runtime manifest, generated from an audit of
`data/curriculum.json` against the files actually present in `public/audio/`.
It supersedes the old `data/stale-audio-manifest.json`. Each entry is keyed by
the curriculum `spokenTextKey` and carries a `status`:

- `available` 鈥� a recording exists at `src`; playback may be attempted.
- `unavailable` 鈥� no recording exists (`src` is `null`); the client must not
  attempt playback and must not report this as a playback failure.

`index.html` still distinguishes: `loading`, `ready`, `playing`, `unavailable`
(recording missing), `playback_failed` (recording exists but playback failed),
and `data_error` (lesson data could not be loaded). `/audio/*` URLs are
rewritten to `public/audio/*` by `vercel.json`, so manifest `src` paths keep
working.

## Coverage

27 of 32 prompts have recordings. Genuinely missing: es-08, fr-07, fr-08,
ja-08, de-08. The supplied WAVs are intentionally tiny fixture recordings.
Missing files are intentional and remain distinguishable from playback
failures.

## Deployment (Vercel + Neon)

Set these environment variables on the Vercel project (never commit them):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection string for the Neon `neondb` database |
| `ADMIN_BOOTSTRAP_TOKEN` | One-time secret used to establish the first admin |
| `BOOTSTRAP_ADMIN_EMAIL` | Email of the account allowed to become the first admin |

### Establishing the first admin (one time only)

There is deliberately no self-service route to admin. The first admin is
created exactly once, and only when all of these hold:

1. Zero admin accounts exist (the endpoint self-disables permanently after
   first success).
2. The caller sends the operator-held `ADMIN_BOOTSTRAP_TOKEN` in the
   `x-bootstrap-token` header.
3. The caller is logged in as the account whose email matches
   `BOOTSTRAP_ADMIN_EMAIL`.

```
curl -X POST https://<deployment>/api/admin/bootstrap \
  -H "x-bootstrap-token: $ADMIN_BOOTSTRAP_TOKEN" \
  --cookie "hl_session=<session cookie from logging in>"
```

After the first admin exists, all further role changes go through the admin
console / `POST /api/admin/users/:id/role` and require an admin session.
The bootstrap env vars can then be removed.
