'use strict';
const { pool, migrate } = require('./_lib/db');
const { send } = require('./_lib/http');

// GET /api/manifest — runtime audio manifest served from Postgres.
//
// This replaces the static data/audio-manifest.json at runtime: availability
// is read from the audio_assets table, so operator UPDATEs (e.g. after new
// recordings land in public/audio/) take effect without a redeploy.
//
// Public, read-only, no authentication: it exposes lesson metadata only.
// 'unavailable' entries deliberately have src = null; clients must not
// attempt playback for them and must not report them as playback failures.
module.exports = async function (req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();

  const r = await pool.query(
    `SELECT spoken_key, prompt_id, language, text, src, status, reason
       FROM audio_assets ORDER BY prompt_id`
  );

  const entries = {};
  const summary = {};
  for (const row of r.rows) {
    const entry = {
      promptId: row.prompt_id,
      language: row.language,
      text: row.text,
      src: row.status === 'available' ? row.src : null,
      status: row.status,
    };
    if (row.status !== 'available' && row.reason) entry.reason = row.reason;
    entries[row.spoken_key] = entry;

    const s = summary[row.language] || (summary[row.language] = { prompts: 0, available: 0, unavailable: 0 });
    s.prompts += 1;
    if (row.status === 'available') s.available += 1; else s.unavailable += 1;
  }

  return send(res, 200, {
    generatedAt: new Date().toISOString(),
    source: 'postgres audio_assets (seeded from the 2026-09-15 audit of data/curriculum.json against public/audio/)',
    states: {
      available: 'a recording exists at src and playback may be attempted',
      unavailable: 'no recording exists for this prompt; the client must not attempt playback and must not report it as a playback failure',
    },
    summary: summary,
    entries: entries,
  });
};
