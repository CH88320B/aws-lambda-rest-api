const fs = require('node:fs');
const path = require('node:path');

const SPEC_PATH = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
let specCache;

function spec() {
  specCache ??= fs.readFileSync(SPEC_PATH, 'utf8');
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/yaml', 'Cache-Control': 'public, max-age=300' },
    body: specCache,
  };
}

const UI_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Products API - Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/docs/openapi.yaml', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`;

function ui() {
  return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: UI_HTML };
}

module.exports = { spec, ui };
