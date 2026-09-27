const { mockClient } = require('aws-sdk-client-mock');
const {
  DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { apiEvent, authHeader, parse } = require('./helpers');
const { handler } = require('../src/index');

const ddb = mockClient(DynamoDBDocumentClient);
const conditionalFailure = () => Object.assign(new Error('failed'), { name: 'ConditionalCheckFailedException' });

const validProduct = { name: 'Mechanical Keyboard', price: 89.9, stock: 25, category: 'peripherals', tags: ['usb', 'usb'] };

beforeEach(() => ddb.reset());

describe('GET /products', () => {
  it('returns items and a pagination cursor', async () => {
    ddb.on(ScanCommand).resolves({ Items: [{ id: 'p1' }], LastEvaluatedKey: { id: 'p1' } });

    const res = parse(await handler(apiEvent('GET', '/products', { query: { limit: '1' } })));

    expect(res.statusCode).toBe(200);
    expect(res.json.items).toEqual([{ id: 'p1' }]);
    expect(res.json.nextCursor).toEqual(expect.any(String));
    expect(ddb.commandCalls(ScanCommand)[0].args[0].input.Limit).toBe(1);
  });

  it('caps the page size and applies the category filter', async () => {
    ddb.on(ScanCommand).resolves({ Items: [] });

    await handler(apiEvent('GET', '/products', { query: { limit: '5000', category: 'books' } }));

    const input = ddb.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.Limit).toBe(100);
    expect(input.ExpressionAttributeValues).toEqual({ ':category': 'books' });
  });

  it('rejects a malformed cursor', async () => {
    const res = await handler(apiEvent('GET', '/products', { query: { cursor: '%%%not-base64' } }));
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /products/{id}', () => {
  it('returns the product', async () => {
    ddb.on(GetCommand).resolves({ Item: { id: 'p1', name: 'Mouse' } });
    const res = parse(await handler(apiEvent('GET', '/products/p1')));
    expect(res.statusCode).toBe(200);
    expect(res.json.name).toBe('Mouse');
  });

  it('returns 404 when missing', async () => {
    ddb.on(GetCommand).resolves({});
    const res = await handler(apiEvent('GET', '/products/missing'));
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /products', () => {
  it('requires authentication', async () => {
    const res = await handler(apiEvent('POST', '/products', { body: validProduct }));
    expect(res.statusCode).toBe(401);
  });

  it('creates a product with normalized fields', async () => {
    ddb.on(PutCommand).resolves({});

    const res = parse(await handler(apiEvent('POST', '/products', {
      body: { ...validProduct, name: '  Mechanical Keyboard  ', unknown: 'stripped' },
      headers: authHeader(),
    })));

    expect(res.statusCode).toBe(201);
    expect(res.json).toMatchObject({ name: 'Mechanical Keyboard', tags: ['usb'], createdBy: 'user-1' });
    expect(res.json.unknown).toBeUndefined();
    expect(res.json.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns 422 with field errors for invalid input', async () => {
    const res = parse(await handler(apiEvent('POST', '/products', {
      body: { name: '', price: -1, stock: 1.5 },
      headers: authHeader(),
    })));

    expect(res.statusCode).toBe(422);
    expect(res.json.details.map((d) => d.field).sort()).toEqual(['name', 'price', 'stock']);
    expect(ddb.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('returns 400 for invalid JSON', async () => {
    const event = apiEvent('POST', '/products', { headers: authHeader() });
    event.body = '{not json';
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /products/{id}', () => {
  it('updates only the provided fields', async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: { id: 'p1', price: 10 } });

    const res = await handler(apiEvent('PUT', '/products/p1', { body: { price: 10 }, headers: authHeader() }));

    expect(res.statusCode).toBe(200);
    const input = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe('SET #price = :price, #updatedAt = :updatedAt');
  });

  it('returns 404 when the product does not exist', async () => {
    ddb.on(UpdateCommand).rejects(conditionalFailure());
    const res = await handler(apiEvent('PUT', '/products/x', { body: { price: 10 }, headers: authHeader() }));
    expect(res.statusCode).toBe(404);
  });

  it('rejects an empty update', async () => {
    const res = await handler(apiEvent('PUT', '/products/p1', { body: {}, headers: authHeader() }));
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /products/{id}', () => {
  it('forbids non-admin users', async () => {
    const res = await handler(apiEvent('DELETE', '/products/p1', { headers: authHeader('user') }));
    expect(res.statusCode).toBe(403);
  });

  it('deletes as admin', async () => {
    ddb.on(DeleteCommand).resolves({});
    const res = await handler(apiEvent('DELETE', '/products/p1', { headers: authHeader('admin') }));
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when the product does not exist', async () => {
    ddb.on(DeleteCommand).rejects(conditionalFailure());
    const res = await handler(apiEvent('DELETE', '/products/p1', { headers: authHeader('admin') }));
    expect(res.statusCode).toBe(404);
  });
});

describe('routing', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await handler(apiEvent('GET', '/nope'));
    expect(res.statusCode).toBe(404);
  });

  it('returns 405 for known paths with the wrong method', async () => {
    const res = await handler(apiEvent('PATCH', '/products'));
    expect(res.statusCode).toBe(405);
  });

  it('returns 500 without leaking internals on unexpected errors', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ddb.on(GetCommand).rejects(new Error('boom'));
    const res = parse(await handler(apiEvent('GET', '/products/p1')));
    expect(res.statusCode).toBe(500);
    expect(res.json.error).toBe('Internal server error');
  });
});
