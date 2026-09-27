// Runs the Lambda handler behind a plain Node HTTP server for local development.
// Pair it with DynamoDB Local: `docker compose up -d && npm run local`.
const http = require('node:http');
const { DynamoDBClient, CreateTableCommand, ResourceInUseException } = require('@aws-sdk/client-dynamodb');

process.env.DYNAMODB_ENDPOINT ??= 'http://localhost:8000';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'local';
process.env.AWS_SECRET_ACCESS_KEY ??= 'local';
process.env.JWT_SECRET ??= 'local-development-secret-change-me-please';

const { handler } = require('../src/index');
const PORT = Number(process.env.PORT || 3000);

async function ensureTables() {
  const client = new DynamoDBClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
  const tables = [
    [process.env.PRODUCTS_TABLE || 'products', 'id'],
    [process.env.USERS_TABLE || 'users', 'email'],
  ];
  for (const [name, key] of tables) {
    try {
      await client.send(new CreateTableCommand({
        TableName: name,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [{ AttributeName: key, AttributeType: 'S' }],
        KeySchema: [{ AttributeName: key, KeyType: 'HASH' }],
      }));
      console.log(`Created table ${name}`);
    } catch (err) {
      if (!(err instanceof ResourceInUseException)) throw err;
    }
  }
}

function toEvent(req, body) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return {
    version: '2.0',
    rawPath: url.pathname,
    headers: req.headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    requestContext: { http: { method: req.method, path: url.pathname } },
    body: body || undefined,
    isBase64Encoded: false,
  };
}

// DynamoDB Local takes a few seconds to accept connections after `docker compose up`.
async function waitForDynamo(attempts = 15) {
  for (let i = 1; ; i++) {
    try {
      return await ensureTables();
    } catch (err) {
      if (i >= attempts || err instanceof ResourceInUseException) throw err;
      console.log(`Waiting for DynamoDB at ${process.env.DYNAMODB_ENDPOINT} (${i}/${attempts})...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function main() {
  await waitForDynamo();

  http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const result = await handler(toEvent(req, Buffer.concat(chunks).toString('utf8')));
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      console.log(`${req.method} ${req.url} -> ${result.statusCode}`);
    });
  }).listen(PORT, () => console.log(`API listening on http://localhost:${PORT} (docs at /docs)`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
