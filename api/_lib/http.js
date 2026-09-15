'use strict';

function send(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (headers) {
    for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  }
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) {
      data += c;
      if (data.length > 1e5) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', function () {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token, maxAgeSec) {
  const cookie = 'hl_session=' + token +
    '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAgeSec;
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'hl_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

module.exports = { send, readBody, parseCookies, setSessionCookie, clearSessionCookie };
