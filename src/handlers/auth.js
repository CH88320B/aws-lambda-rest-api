const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { doc, tables } = require('../lib/dynamo');
const { ok, created, HttpError } = require('../lib/response');
const { validate } = require('../lib/validation');
const { signToken } = require('../lib/auth');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;
// Compared against when the user does not exist, so login timing does not reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-placeholder', BCRYPT_ROUNDS);

const registerSchema = {
  email: { type: 'string', required: true, maxLength: 254, pattern: EMAIL },
  password: { type: 'string', required: true, minLength: 8, maxLength: 72 },
  name: { type: 'string', required: true, maxLength: 100 },
};

const loginSchema = {
  email: { type: 'string', required: true, pattern: EMAIL },
  password: { type: 'string', required: true },
};

// Users are keyed by normalized email so lookups at login are a single GetItem.
const normalizeEmail = (email) => email.trim().toLowerCase();

const publicUser = ({ passwordHash: _passwordHash, ...user }) => user;

async function register({ body }) {
  const data = validate(body, registerSchema);
  const email = normalizeEmail(data.email);

  const user = {
    email,
    id: crypto.randomUUID(),
    name: data.name,
    role: 'user',
    passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
    createdAt: new Date().toISOString(),
  };

  try {
    await doc.send(new PutCommand({
      TableName: tables.users(),
      Item: user,
      ConditionExpression: 'attribute_not_exists(email)',
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'Email already registered');
    throw err;
  }

  return created({ user: publicUser(user), token: signToken(user) });
}

async function login({ body }) {
  const data = validate(body, loginSchema);
  const res = await doc.send(new GetCommand({
    TableName: tables.users(),
    Key: { email: normalizeEmail(data.email) },
  }));

  const user = res.Item;
  const valid = await bcrypt.compare(data.password, user?.passwordHash || DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Invalid email or password');

  return ok({ user: publicUser(user), token: signToken(user) });
}

async function me({ user }) {
  const res = await doc.send(new GetCommand({ TableName: tables.users(), Key: { email: user.email } }));
  if (!res.Item) throw new HttpError(404, 'User not found');
  return ok(publicUser(res.Item));
}

module.exports = { register, login, me };
