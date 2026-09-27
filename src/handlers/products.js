const crypto = require('node:crypto');
const {
  GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { doc, tables, encodeCursor, decodeCursor } = require('../lib/dynamo');
const { ok, created, noContent, HttpError } = require('../lib/response');
const { validate } = require('../lib/validation');

const productSchema = {
  name: { type: 'string', required: true, maxLength: 120 },
  description: { type: 'string', maxLength: 2000 },
  price: { type: 'number', required: true, min: 0 },
  stock: { type: 'integer', required: true, min: 0 },
  category: { type: 'string', maxLength: 60 },
  tags: { type: 'array' },
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

async function list({ query }) {
  const limit = Math.min(parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const startKey = decodeCursor(query.cursor);
  if (startKey === null) throw new HttpError(400, 'Invalid cursor');

  const params = { TableName: tables.products(), Limit: limit, ExclusiveStartKey: startKey };
  if (query.category) {
    params.FilterExpression = '#category = :category';
    params.ExpressionAttributeNames = { '#category': 'category' };
    params.ExpressionAttributeValues = { ':category': query.category };
  }

  const res = await doc.send(new ScanCommand(params));
  return ok({ items: res.Items || [], nextCursor: encodeCursor(res.LastEvaluatedKey) });
}

async function get({ params }) {
  const res = await doc.send(new GetCommand({ TableName: tables.products(), Key: { id: params.id } }));
  if (!res.Item) throw new HttpError(404, 'Product not found');
  return ok(res.Item);
}

async function create({ body, user }) {
  const data = validate(body, productSchema);
  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    ...data,
    createdBy: user?.sub,
    createdAt: now,
    updatedAt: now,
  };
  await doc.send(new PutCommand({
    TableName: tables.products(),
    Item: item,
    ConditionExpression: 'attribute_not_exists(id)',
  }));
  return created(item);
}

async function update({ params, body }) {
  const data = validate(body, productSchema, { partial: true });
  data.updatedAt = new Date().toISOString();

  const names = {};
  const values = {};
  const sets = Object.keys(data).map((key) => {
    names[`#${key}`] = key;
    values[`:${key}`] = data[key];
    return `#${key} = :${key}`;
  });

  try {
    const res = await doc.send(new UpdateCommand({
      TableName: tables.products(),
      Key: { id: params.id },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ConditionExpression: 'attribute_exists(id)',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    return ok(res.Attributes);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') throw new HttpError(404, 'Product not found');
    throw err;
  }
}

async function remove({ params }) {
  try {
    await doc.send(new DeleteCommand({
      TableName: tables.products(),
      Key: { id: params.id },
      ConditionExpression: 'attribute_exists(id)',
    }));
    return noContent();
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') throw new HttpError(404, 'Product not found');
    throw err;
  }
}

module.exports = { list, get, create, update, remove, productSchema };
