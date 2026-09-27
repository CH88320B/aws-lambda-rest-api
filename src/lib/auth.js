const jwt = require('jsonwebtoken');
const { HttpError } = require('./response');

const ISSUER = 'aws-lambda-rest-api';
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '1h';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  return value;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret(),
    { algorithm: 'HS256', expiresIn: TOKEN_TTL, issuer: ISSUER },
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: ISSUER });
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    throw new HttpError(401, message);
  }
}

/** Route middleware: attaches the decoded token to ctx.user or rejects with 401. */
function requireAuth(ctx) {
  const header = ctx.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Missing bearer token');
  }
  ctx.user = verifyToken(token);
}

/** Route middleware factory: requires one of the given roles. Use after requireAuth. */
const requireRole = (...roles) => (ctx) => {
  if (!roles.includes(ctx.user?.role)) {
    throw new HttpError(403, 'Insufficient permissions');
  }
};

module.exports = { signToken, verifyToken, requireAuth, requireRole };
