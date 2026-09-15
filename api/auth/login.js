'use strict';
const { pool, migrate } = require('../_lib/db');
const { send, readBody } = require('../_lib/http');
const { verifyPassword, createSession, logInteraction } = require('../_lib/auth');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();
  const body = await readBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  const r = await pool.query(
    'SELECT id, name, email, role, password_hash FROM app_users WHERE email = $1',
    [email]
  );
  const row = r.rows[0];
  const ok = row ? await verifyPassword(password, row.password_hash) : false;
  if (!ok) return send(res, 401, { error: 'invalid_credentials' });

  await createSession(res, row.id);
  await logInteraction(row.id, 'login');
  return send(res, 200, { user: { id: row.id, name: row.name, email: row.email, role: row.role } });
};
