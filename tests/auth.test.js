const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { apiEvent, authHeader, parse } = require('./helpers');
const { handler } = require('../src/index');

const ddb = mockClient(DynamoDBDocumentClient);

beforeEach(() => ddb.reset());

describe('POST /auth/register', () => {
  it('stores a hashed password and returns a token', async () => {
    ddb.on(PutCommand).resolves({});

    const res = parse(await handler(apiEvent('POST', '/auth/register', {
      body: { email: 'Jane@Example.com', password: 'correct-horse', name: 'Jane' },
    })));

    expect(res.statusCode).toBe(201);
    expect(res.json.user.email).toBe('jane@example.com');
    expect(res.json.user.passwordHash).toBeUndefined();
    expect(jwt.decode(res.json.token)).toMatchObject({ email: 'jane@example.com', role: 'user' });

    const stored = ddb.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(await bcrypt.compare('correct-horse', stored.passwordHash)).toBe(true);
  });

  it('returns 409 for a duplicate email', async () => {
    ddb.on(PutCommand).rejects(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    const res = await handler(apiEvent('POST', '/auth/register', {
      body: { email: 'jane@example.com', password: 'correct-horse', name: 'Jane' },
    }));
    expect(res.statusCode).toBe(409);
  });

  it('validates email format and password length', async () => {
    const res = parse(await handler(apiEvent('POST', '/auth/register', {
      body: { email: 'not-an-email', password: 'short', name: 'Jane' },
    })));
    expect(res.statusCode).toBe(422);
    expect(res.json.details.map((d) => d.field).sort()).toEqual(['email', 'password']);
  });
});

describe('POST /auth/login', () => {
  const storedUser = async () => ({
    id: 'user-1',
    email: 'jane@example.com',
    name: 'Jane',
    role: 'user',
    passwordHash: await bcrypt.hash('correct-horse', 4),
  });

  it('returns a token for valid credentials', async () => {
    ddb.on(GetCommand).resolves({ Item: await storedUser() });
    const res = parse(await handler(apiEvent('POST', '/auth/login', {
      body: { email: 'JANE@example.com', password: 'correct-horse' },
    })));
    expect(res.statusCode).toBe(200);
    expect(res.json.token).toEqual(expect.any(String));
    expect(ddb.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ email: 'jane@example.com' });
  });

  it('returns 401 for a wrong password', async () => {
    ddb.on(GetCommand).resolves({ Item: await storedUser() });
    const res = await handler(apiEvent('POST', '/auth/login', {
      body: { email: 'jane@example.com', password: 'wrong-password' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns the same 401 for an unknown email', async () => {
    ddb.on(GetCommand).resolves({});
    const res = parse(await handler(apiEvent('POST', '/auth/login', {
      body: { email: 'ghost@example.com', password: 'whatever1' },
    })));
    expect(res.statusCode).toBe(401);
    expect(res.json.error).toBe('Invalid email or password');
  });
});

describe('GET /auth/me', () => {
  it('rejects a tampered token', async () => {
    const forged = jwt.sign({ sub: 'x', role: 'admin' }, 'another-secret-another-secret-12345', { issuer: 'aws-lambda-rest-api' });
    const res = await handler(apiEvent('GET', '/auth/me', { headers: { Authorization: `Bearer ${forged}` } }));
    expect(res.statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_SECRET,
      { issuer: 'aws-lambda-rest-api' },
    );
    const res = parse(await handler(apiEvent('GET', '/auth/me', { headers: { authorization: `Bearer ${expired}` } })));
    expect(res.statusCode).toBe(401);
    expect(res.json.error).toBe('Token expired');
  });

  it('returns the current user profile', async () => {
    ddb.on(GetCommand).resolves({ Item: { id: 'user-1', email: 'jane@example.com', passwordHash: 'x' } });
    const res = parse(await handler(apiEvent('GET', '/auth/me', { headers: authHeader() })));
    expect(res.statusCode).toBe(200);
    expect(res.json).toEqual({ id: 'user-1', email: 'jane@example.com' });
  });
});
