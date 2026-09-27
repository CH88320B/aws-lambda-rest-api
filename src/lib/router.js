const { HttpError } = require('./response');

/**
 * Minimal router for API Gateway HTTP API (payload v2) events.
 * Routes are declared as "METHOD /path/{param}".
 */
class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, ...handlers) {
    const keys = [];
    const pattern = path.replace(/\{(\w+)\}/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.routes.push({ method, regex: new RegExp(`^${pattern}/?$`), keys, handlers });
    return this;
  }

  get(path, ...h) { return this.add('GET', path, ...h); }
  post(path, ...h) { return this.add('POST', path, ...h); }
  put(path, ...h) { return this.add('PUT', path, ...h); }
  delete(path, ...h) { return this.add('DELETE', path, ...h); }

  match(method, path) {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = {};
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route, params };
    }
    throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Method not allowed' : 'Not found');
  }

  async handle(event) {
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path;
    const { route, params } = this.match(method, path);

    const ctx = {
      event,
      params,
      query: event.queryStringParameters || {},
      headers: lowerCaseKeys(event.headers || {}),
      body: parseBody(event),
    };

    let result;
    for (const handler of route.handlers) {
      result = await handler(ctx);
      if (result) return result;
    }
    return result;
  }
}

function lowerCaseKeys(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

module.exports = { Router };
