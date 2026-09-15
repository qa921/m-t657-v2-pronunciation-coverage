'use strict';
const { pool, migrate } = require('../../_lib/db');
const { send } = require('../../_lib/http');
const { requireAdmin, logInteraction } = require('../../_lib/auth');

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// GET /api/admin/export?format=json|csv
// Admin-only full export. Every export is itself audit-logged.
module.exports = async function (req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();
  const admin = await requireAdmin(req, res, send);
  if (!admin) return;

  const format = ((req.query && req.query.format) || 'json').toLowerCase();
  await logInteraction(admin.id, 'export', { detail: { format: format } });

  if (format === 'csv') {
    const r = await pool.query(
      `SELECT u.id AS user_id, u.name, u.email, u.role, u.created_at AS user_created_at,
              p.prompt_id, p.status, p.plays, p.updated_at AS progress_updated_at
         FROM app_users u
         LEFT JOIN learner_progress p ON p.learner_id = u.id
        ORDER BY u.created_at, p.prompt_id`
    );
    const header = 'user_id,name,email,role,user_created_at,prompt_id,status,plays,progress_updated_at';
    const lines = r.rows.map(function (row) {
      return [row.user_id, row.name, row.email, row.role, row.user_created_at && row.user_created_at.toISOString(),
              row.prompt_id, row.status, row.plays, row.progress_updated_at && row.progress_updated_at.toISOString()]
        .map(csvCell).join(',');
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="harbor-language-export.csv"');
    return res.end(header + '\n' + lines.join('\n') + '\n');
  }

  const users = await pool.query(
    'SELECT id, name, email, role, created_at AS "createdAt", updated_at AS "updatedAt" FROM app_users ORDER BY created_at'
  );
  const progress = await pool.query(
    `SELECT learner_id AS "learnerId", prompt_id AS "promptId", status, plays, updated_at AS "updatedAt"
       FROM learner_progress ORDER BY learner_id, prompt_id`
  );
  const interactions = await pool.query(
    `SELECT i.id, i.user_id AS "userId", i.type, i.prompt_id AS "promptId", i.language, i.detail,
            i.created_at AS "createdAt"
       FROM interactions i ORDER BY i.created_at DESC LIMIT 10000`
  );

  return send(res, 200, {
    exportedAt: new Date().toISOString(),
    exportedBy: admin.email,
    users: users.rows,
    progress: progress.rows,
    interactions: interactions.rows,
  });
};
