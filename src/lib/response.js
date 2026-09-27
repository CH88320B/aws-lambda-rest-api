const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { ...DEFAULT_HEADERS, ...headers },
  body: body === undefined ? '' : JSON.stringify(body),
});

const ok = (body) => json(200, body);
const created = (body) => json(201, body);
const noContent = () => json(204);

const error = (err) => {
  if (err instanceof HttpError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return json(err.statusCode, body);
  }
  console.error('Unhandled error', err);
  return json(500, { error: 'Internal server error' });
};

module.exports = { HttpError, json, ok, created, noContent, error };
