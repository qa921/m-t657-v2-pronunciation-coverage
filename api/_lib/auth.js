'use strict';
const crypto = require('crypto');
const { pool } = require('./db');
const { parseCookies, setSessionCookie } = require('./http');

const SESSION_TTL_SEC = 30 * 24 * 3600; // 30 days

function scryptAsync(password, salt) {
  return new Promise(function (resolve, reject) {
    crypto.scrypt(password, salt, 64, function (err, key) {
      if (err) reject(err); else resolve(key);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt);
  return 'scrypt:' + salt + ':' + key.toString('hex');
}

async function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split(':');
    if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
    const key = await scryptAsync(password, parts[1]);
    const expected = Buffer.from(parts[2], 'hex');
    return expected.length === key.length && crypto.timingSafeEqual(key, expected);
  } catch (e) {
    return false;
  }
}

async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval \'30 days\')',
    [token, userId]
  );
  setSessionCookie(res, token, SESSION_TTL_SEC);
}

async function getSessionUser(req) {
  const token = parseCookies(req).hl_session;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await pool.query(
    `SELECT u.id, u.name, u.email, u.role
       FROM sessions s JOIN app_users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return r.rows[0] || null;
}

async function requireUser(req, res, send) {
  const user = await getSessionUser(req);
  if (!user) {
    send(res, 401, { error: 'not_authenticated' });
    return null;
  }
  return user;
}

// Role is read from the database session record only. It is never derived
// from client-supplied data, so no account can escalate its own privileges.
async function requireAdmin(req, res, send) {
  const user = await requireUser(req, res, send);
  if (!user) return null;
  if (user.role !== 'admin') {
    send(res, 403, { error: 'forbidden' });
    return null;
  }
  return user;
}

async function logInteraction(userId, type, opts) {
  opts = opts || {};
  try {
    await pool.query(
      'INSERT INTO interactions (user_id, type, prompt_id, language, detail) VALUES ($1, $2, $3, $4, $5)',
      [userId, type, opts.promptId || null, opts.language || null, opts.detail ? JSON.stringify(opts.detail) : null]
    );
  } catch (e) {
    // audit logging must never break the request path
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  requireUser,
  requireAdmin,
  logInteraction,
};
