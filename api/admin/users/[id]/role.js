'use strict';
const { pool, migrate } = require('../../../_lib/db');
const { send, readBody } = require('../../../_lib/http');
const { requireAdmin, logInteraction } = require('../../../_lib/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/users/:id/role { role: 'learner' | 'admin' }
// Admin-only. Safeguards:
//   - an admin cannot change their own role (no self-demotion / lockout tricks)
//   - the last remaining admin cannot be demoted
//   - every change is audit-logged in interactions
module.exports = async function (req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();
  const admin = await requireAdmin(req, res, send);
  if (!admin) return;

  const id = String((req.query && req.query.id) || '');
  if (!UUID_RE.test(id)) return send(res, 400, { error: 'invalid_user_id' });

  const body = await readBody(req);
  const role = String(body.role || '');
  if (role !== 'learner' && role !== 'admin') return send(res, 400, { error: 'invalid_role' });

  if (id === admin.id) {
    return send(res, 400, { error: 'cannot_change_own_role', detail: 'Ask another admin to change your role.' });
  }

  const target = await pool.query('SELECT id, name, email, role FROM app_users WHERE id = $1', [id]);
  if (!target.rows[0]) return send(res, 404, { error: 'user_not_found' });
  const t = target.rows[0];

  if (t.role === role) return send(res, 200, { user: t, unchanged: true });

  if (t.role === 'admin' && role === 'learner') {
    const admins = await pool.query("SELECT count(*)::int AS n FROM app_users WHERE role = 'admin'");
    if (admins.rows[0].n <= 1) {
      return send(res, 400, { error: 'last_admin', detail: 'The last remaining admin cannot be demoted.' });
    }
  }

  const r = await pool.query(
    'UPDATE app_users SET role = $1, updated_at = now() WHERE id = $2 RETURNING id, name, email, role',
    [role, id]
  );
  await logInteraction(admin.id, 'role_change', {
    detail: { target_user_id: id, target_email: t.email, from: t.role, to: role },
  });
  return send(res, 200, { user: r.rows[0] });
};
