'use strict';
const { pool, migrate } = require('../../_lib/db');
const { send } = require('../../_lib/http');
const { requireAdmin } = require('../../_lib/auth');

const TYPES = { register: 1, login: 1, logout: 1, play: 1, progress_update: 1, role_change: 1, export: 1, bootstrap: 1 };

// GET /api/admin/interactions?user=&type=&promptId=&language=&from=&to=&limit=&offset=
//   user     - substring match on user email
//   from/to  - ISO dates (created_at range)
module.exports = async function (req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();
  const admin = await requireAdmin(req, res, send);
  if (!admin) return;

  const q = req.query || {};
  const where = [];
  const params = [];

  if (q.user && String(q.user).trim()) {
    params.push('%' + String(q.user).trim().toLowerCase() + '%');
    where.push('lower(u.email) LIKE $' + params.length);
  }
  if (q.type && TYPES[q.type]) {
    params.push(q.type);
    where.push('i.type = $' + params.length);
  }
  if (q.promptId && String(q.promptId).trim()) {
    params.push(String(q.promptId).trim());
    where.push('i.prompt_id = $' + params.length);
  }
  if (q.language && /^(es|fr|ja|de)$/.test(q.language)) {
    params.push(q.language);
    where.push('i.language = $' + params.length);
  }
  if (q.from && !isNaN(Date.parse(q.from))) {
    params.push(new Date(q.from).toISOString());
    where.push('i.created_at >= $' + params.length);
  }
  if (q.to && !isNaN(Date.parse(q.to))) {
    params.push(new Date(q.to).toISOString());
    where.push('i.created_at <= $' + params.length);
  }

  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(parseInt(q.limit, 10) || 50, 500);
  const offset = parseInt(q.offset, 10) || 0;

  const count = await pool.query(
    'SELECT count(*)::int AS n FROM interactions i LEFT JOIN app_users u ON u.id = i.user_id' + whereSql,
    params
  );

  params.push(limit, offset);
  const rows = await pool.query(
    `SELECT i.id, i.type, i.prompt_id AS "promptId", i.language, i.detail,
            i.created_at AS "createdAt", u.email AS "userEmail", u.name AS "userName"
       FROM interactions i LEFT JOIN app_users u ON u.id = i.user_id
      ${whereSql}
      ORDER BY i.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return send(res, 200, { total: count.rows[0].n, interactions: rows.rows });
};
