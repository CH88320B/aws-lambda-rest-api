const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});

const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const tables = {
  products: () => process.env.PRODUCTS_TABLE || 'products',
  users: () => process.env.USERS_TABLE || 'users',
};

const encodeCursor = (key) => (key ? Buffer.from(JSON.stringify(key)).toString('base64url') : null);

const decodeCursor = (cursor) => {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

module.exports = { doc, tables, encodeCursor, decodeCursor };
