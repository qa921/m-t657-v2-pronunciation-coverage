'use strict';
const { pool, migrate } = require('../_lib/db');
const { send, readBody } = require('../_lib/http');
const { hashPassword, createSession, logInteraction } = require('../_lib/auth');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

module.exports = async function (req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();
  const body = await readBody(req);
  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  const password = String(body.password || '');

  if (!name) return send(res, 400, { error: 'name_required' });
  if (!EMAIL_RE.test(email)) return send(res, 400, { error: 'invalid_email' });
  if (password.length < 8) return send(res, 400, { error: 'password_too_short', detail: 'Minimum 8 characters.' });

  // SECURITY: every public registration is a learner. Role is never taken
  // from the request body, so no account can grant itself admin here.
  try {
    const hash = await hashPassword(password);
    const r = await pool.query(
      `INSERT INTO app_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'learner') RETURNING id, name, email, role`,
      [name, email, hash]
    );
    const user = r.rows[0];
    await createSession(res, user.id);
    await logInteraction(user.id, 'register');
    return send(res, 201, { user: user });
  } catch (err) {
    if (err && err.code === '23505') return send(res, 409, { error: 'email_taken' });
    throw err;
  }
};
