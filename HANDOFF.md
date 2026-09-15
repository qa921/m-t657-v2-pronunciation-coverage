# Developer Handoff — Harbor Language (M-T657-V2)

_Release pass completed 2026-09-15._

## Links

- Repository: https://github.com/qa921/m-t657-v2-pronunciation-coverage
- Release commit: [`87da772`](https://github.com/qa921/m-t657-v2-pronunciation-coverage/commit/87da77270fa3d45cd254df661a26b947e85a5443) (`87da77270fa3d45cd254df661a26b947e85a5443`, branch `main`)
- Vercel project: `m-t657-v2-pronunciation-coverage` — https://vercel.com/agent51-testing/m-t657-v2-pronunciation-coverage
- Neon project: `qa-cd-neon` (`icy-heart-57214046`), database `neondb`, branch `main` (`br-lucky-pine-apdfdkdo`)

## Confirmed complete (in source, committed to `main`)

- **Learner accounts**: register / login / logout / me (`api/auth/*`) with
  scrypt-hashed passwords and HttpOnly session cookies. Public registration
  can only create `learner` accounts; role is read from the DB session, never
  from client-supplied data.
- **Learner progress**: `GET/POST /api/progress` upserts the caller's own
  `learner_progress` row only.
- **Lesson/game activity**: completed playbacks increment the per-prompt
  `plays` counter and write `play` interactions; status changes write
  `progress_update` interactions. All activity lands in the append-only
  `interactions` audit log.
- **Admin review & export**: `/admin.html` + `api/admin/*` — user search and
  filters, learner detail, role management (cannot change your own role, the
  last admin cannot be demoted, all changes audit-logged), interactions
  browser with filters and pagination, and audit-logged JSON/CSV export at
  `/api/admin/export`.
- **Runtime manifest route**: `GET /api/manifest` serves the audio manifest
  from the Postgres `audio_assets` table (created and seeded idempotently by
  the cold-start migration; seed = the 2026-09-15 audit of
  `data/curriculum.json` against `public/audio/`). The learner client now
  fetches `/api/manifest`; `data/audio-manifest.json` remains as a static
  reference snapshot only — no local JSON is read at runtime.
- **Playback state contract**: `unavailable` (no recording — playback never
  attempted, never reported as a failure) is distinct from `playback_failed`
  (recording exists but playback failed). Coverage: 27 of 32 prompts
  available; es-08, fr-07, fr-08, ja-08, de-08 are intentionally unavailable
  with `src: null` and `reason: recording_missing`.
- **Repo hygiene**: no credentials in the repo; `.gitignore` excludes env
  files. `DATABASE_URL`, `ADMIN_BOOTSTRAP_TOKEN`, and `BOOTSTRAP_ADMIN_EMAIL`
  exist only as Vercel project environment variables.

## Confirmed live

- Production deployment: **PENDING** at the time this file was added (see
  commit history for the post-deployment update of this section).

## Still needs live verification

- **Deployment**: production deployment of commit `87da772…` and smoke checks
  of `/`, `/api/manifest`, and an audio URL such as `/audio/es/buenos-dias.wav`
  (served via the `vercel.json` rewrite to `public/audio/`).
- **Database (live)**: the schema is applied idempotently by `migrate()` on
  the first API cold start, so no manual migration step is required. Direct
  SQL verification against Neon was **not** performed in this pass (no live
  SQL channel was available through the existing connection). After the first
  API request, confirm the tables exist and that `audio_assets` holds 32 rows
  (27 `available` / 5 `unavailable`).
- **Admin bootstrap / auth (live)**: `BOOTSTRAP_ADMIN_EMAIL` and
  `ADMIN_BOOTSTRAP_TOKEN` are provisioned on the Vercel project (the token is
  held by the operator, not in this repo). The one-time bootstrap has not been
  executed yet: register/log in with the bootstrap email, then
  `POST /api/admin/bootstrap` with header `x-bootstrap-token`. The endpoint
  permanently closes after the first success; remove both env vars afterwards.
- **Playback (live)**: confirm the five intentionally unavailable prompts
  render as "Recording unavailable" (not as playback errors), and that an
  available prompt plays end-to-end and records a `play` interaction plus a
  `plays` increment visible in the admin console.
