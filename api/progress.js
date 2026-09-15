'use strict';
const { pool, migrate } = require('../_lib/db');
const { send, readBody } = require('../_lib/http');
const { requireUser, logInteraction } = require('../_lib/auth');

const PROMPT_RE = /^(es|fr|ja|de)-(0[1-9]|10)$/;
const STATUSES = { new: true, in_progress: true, completed: true };

module.exports = async function (req, res) {
  await migrate();
  const user = await requireUser(req, res, send);
  if (!user) return;

  if (req.method === 'GET') {
    const r = await pool.query(
      `SELECT prompt_id AS "promptId", status, plays, updated_at AS "updatedAt"
         FROM learner_progress WHERE learner_id = $1 ORDER BY updated_at DESC`,
      [user.id]
    );
    return send(res, 200, { progress: r.rows });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const promptId = String(body.promptId || '');
    const status = String(body.status || '');
    if (!PROMPT_RE.test(promptId)) return send(res, 400, { error: 'invalid_prompt' });
    if (!STATUSES[status]) return send(res, 400, { error: 'invalid_status' });

    // Learners can only ever write their OWN progress row.
    const r = await pool.query(
      `INSERT INTO learner_progress (learner_id, prompt_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (learner_id, prompt_id)
       DO UPDATE SET status = EXCLUDED.status, updated_at = now()
       RETURNING prompt_id AS "promptId", status, updated_at AS "updatedAt"`,
      [user.id, promptId, status]
    );
    await logInteraction(user.id, 'progress_update', {
      promptId: promptId,
      language: promptId.slice(0, 2),
      detail: { status: status },
    });
    return send(res, 200, { progress: r.rows[0] });
  }

  return send(res, 405, { error: 'method_not_allowed' });
};
