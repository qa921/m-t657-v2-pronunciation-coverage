'use strict';
const { pool, migrate } = require('../_lib/db');
const { send, readBody } = require('../_lib/http');
const { requireUser, logInteraction } = require('../_lib/auth');

// One-time first-admin bootstrap.
//
// This is intentionally NOT a self-service route. It only succeeds when ALL
// of the following hold:
//   1. There are currently ZERO admin accounts (it self-disables forever after
//      the first success - after that, only existing admins can grant admin).
//   2. The deployment operator has set ADMIN_BOOTSTRAP_TOKEN (a secret held
//      only in Vercel env vars) and the request presents it in
//      the x-bootstrap-token header.
//   3. The deployment operator has pre-declared the first admin's email in
//      BOOTSTRAP_ADMIN_EMAIL, and the caller is logged in as that account.
// If either env var is unset, this endpoint is permanently inert.
module.exports = async function (req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();

  const admins = await pool.query("SELECT count(*)::int AS n FROM app_users WHERE role = 'admin'");
  if (admins.rows[0].n > 0) {
    return send(res, 410, { error: 'bootstrap_closed', detail: 'An admin already exists. Role changes are admin-only via /api/admin/users/:id/role.' });
  }

  const token = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!token || !email) {
    return send(res, 403, {
      error: 'bootstrap_not_configured',
      detail: 'The operator must set ADMIN_BOOTSTRAP_TOKEN and BOOTSTRAP_ADMIN_EMAIL in the Vercel project environment before the first admin can be established.',
    });
  }

  const provided = String(req.headers['x-bootstrap-token'] || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  const tokenOk = a.length === b.length && require('crypto').timingSafeEqual(a, b);
  if (!tokenOk) return send(res, 403, { error: 'invalid_bootstrap_token' });

  const user = await requireUser(req, res, send);
  if (!user) return;
  if (String(user.email).toLowerCase() !== email) {
    return send(res, 403, { error: 'email_not_authorized', detail: 'This account is not the pre-declared bootstrap admin.' });
  }

  const r = await pool.query(
    "UPDATE app_users SET role = 'admin', updated_at = now() WHERE id = $1 RETURNING id, name, email, role",
    [user.id]
  );
  await logInteraction(user.id, 'bootstrap', { detail: { granted_role: 'admin' } });
  return send(res, 200, { user: r.rows[0], note: 'First admin established. This endpoint is now permanently closed.' });
};
