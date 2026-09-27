process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.PRODUCTS_TABLE = 'products-test';
process.env.USERS_TABLE = 'users-test';

const { signToken } = require('../src/lib/auth');

/** Builds an API Gateway HTTP API (payload v2) event. */
function apiEvent(method, path, { body, headers = {}, query } = {}) {
  return {
    version: '2.0',
    rawPath: path,
    headers,
    queryStringParameters: query,
    requestContext: { http: { method, path } },
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function authHeader(role = 'user') {
  const token = signToken({ id: 'user-1', email: 'jane@example.com', role });
  return { Authorization: `Bearer ${token}` };
}

const parse = (res) => ({ ...res, json: res.body ? JSON.parse(res.body) : undefined });

module.exports = { apiEvent, authHeader, parse };
