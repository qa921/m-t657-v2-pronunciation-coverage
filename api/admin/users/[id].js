'use strict';
const { pool, migrate } = require('../../_lib/db');
const { send } = require('../../_lib/http');
const { requireAdmin } = require('../../_lib/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/users/:id -> learner detail: profile + progress + recent interactions
module.exports = async function (req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();
  const admin = await requireAdmin(req, res, send);
  if (!admin) return;

  const id = String((req.query && req.query.id) || '');
  if (!UUID_RE.test(id)) return send(res, 400, { error: 'invalid_user_id' });

  const u = await pool.query(
    'SELECT id, name, email, role, created_at AS "createdAt", updated_at AS "updatedAt" FROM app_users WHERE id = $1',
    [id]
  );
  if (!u.rows[0]) return send(res, 404, { error: 'user_not_found' });

  const progress = await pool.query(
    `SELECT prompt_id AS "promptId", status, plays, updated_at AS "updatedAt"
       FROM learner_progress WHERE learner_id = $1 ORDER BY updated_at DESC`,
    [id]
  );

  const interactions = await pool.query(
    `SELECT id, type, prompt_id AS "promptId", language, detail, created_at AS "createdAt"
       FROM interactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [id]
  );

  return send(res, 200, { user: u.rows[0], progress: progress.rows, interactions: interactions.rows });
};
