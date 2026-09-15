'use strict';
const { pool, migrate } = require('../_lib/db');
const { send } = require('../_lib/http');
const { requireAdmin } = require('../_lib/auth');

// GET /api/admin/users?q=&role=learner|admin&hasProgress=true|false&limit=&offset=
module.exports = async function (req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();
  const admin = await requireAdmin(req, res, send);
  if (!admin) return;

  const q = req.query || {};
  const where = [];
  const params = [];

  if (q.role === 'learner' || q.role === 'admin') {
    params.push(q.role);
    where.push('u.role = $' + params.length);
  }
  if (q.q && String(q.q).trim()) {
    params.push('%' + String(q.q).trim().toLowerCase() + '%');
    where.push('(lower(u.email) LIKE $' + params.length + ' OR lower(u.name) LIKE $' + params.length + ')');
  }
  if (q.hasProgress === 'true') where.push('EXISTS (SELECT 1 FROM learner_progress lp0 WHERE lp0.learner_id = u.id)');
  if (q.hasProgress === 'false') where.push('NOT EXISTS (SELECT 1 FROM learner_progress lp0 WHERE lp0.learner_id = u.id)');

  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(parseInt(q.limit, 10) || 50, 200);
  const offset = parseInt(q.offset, 10) || 0;

  const count = await pool.query('SELECT count(*)::int AS n FROM app_users u' + whereSql, params);

  params.push(limit, offset);
  const rows = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at AS "createdAt",
            COALESCE(p.total, 0)::int AS "progressTotal",
            COALESCE(p.completed, 0)::int AS "progressCompleted",
            COALESCE(p.in_progress, 0)::int AS "progressInProgress"
       FROM app_users u
       LEFT JOIN (
         SELECT learner_id, count(*) AS total,
                count(*) FILTER (WHERE status = 'completed') AS completed,
                count(*) FILTER (WHERE status = 'in_progress') AS in_progress
           FROM learner_progress GROUP BY learner_id
       ) p ON p.learner_id = u.id
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return send(res, 200, { total: count.rows[0].n, users: rows.rows });
};
