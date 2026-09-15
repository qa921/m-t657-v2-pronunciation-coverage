'use strict';
const { migrate } = require('../_lib/db');
const { send } = require('../_lib/http');
const { getSessionUser } = require('../_lib/auth');

module.exports = async function (req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  await migrate();
  const user = await getSessionUser(req);
  if (!user) return send(res, 200, { user: null });
  return send(res, 200, { user: { id: user.id, name: user.name, email: user.email, role: user.role } });
};
