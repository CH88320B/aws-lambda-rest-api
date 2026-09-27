// Builds dist/ with the Lambda source and production dependencies only.
// Terraform zips this directory with archive_file.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

for (const entry of ['src', 'docs', 'package.json', 'package-lock.json']) {
  fs.cpSync(path.join(root, entry), path.join(dist, entry), { recursive: true });
}

execSync('npm ci --omit=dev --ignore-scripts --no-audit --no-fund', { cwd: dist, stdio: 'inherit' });
console.log(`Lambda bundle ready at ${path.relative(root, dist)}/`);
