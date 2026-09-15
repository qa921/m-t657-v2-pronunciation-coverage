# M-T657-V2 Pronunciation Coverage

Audio-focused language-learning release across Spanish, French, Japanese, and German.

## Runtime manifest

`data/audio-manifest.json` is the runtime manifest, generated from an audit of
`data/curriculum.json` against the files actually present in `public/audio/`.
It supersedes the old `data/stale-audio-manifest.json`, which had incorrect keys
(`es.donde-estacion`, `fr.ou-est-gare`), missing entries (`ja.eki-wa-doko`), and
paths pointing at files that do not exist. Each entry is keyed by the curriculum
`spokenTextKey` and carries a `status`:

- `available` — a recording exists at `src`; playback may be attempted.
- `unavailable` — no recording exists (`src` is `null`); the client must not
  attempt playback and must not report this as a playback failure.

## Learner states

`index.html` distinguishes: `loading`, `ready`, `playing`, `unavailable`
(recording missing), `playback_failed` (recording exists but playback failed),
and `data_error` (lesson data could not be loaded).

## Learner persistence

`data/learner-progress-prior-state.json` is a prior-state export of the Neon
`learner_progress` table and represents the database-backed learner persistence
contract. It is unchanged by this release.

## Coverage

27 of 32 prompts have recordings. Genuinely missing: es-08, fr-07, fr-08,
ja-08, de-08. The supplied WAVs are intentionally tiny fixture recordings.
Missing files are intentional and remain distinguishable from playback failures.
