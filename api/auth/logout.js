'use strict';
const { pool } = require('../_lib/db');
const { send, parseCookies, clearSessionCookie } = require('../_lib/http');
const { logInteraction, getSessionUser } = require('../_lib/auth');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const user = await getSessionUser(req);
  const token = parseCookies(req).hl_session;
  if (token) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  }
  if (user) await logInteraction(user.id, 'logout');
  clearSessionCookie(res);
  return send(res, 200, { ok: true });
};
