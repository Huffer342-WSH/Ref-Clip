const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'l10n', 'manifest');
const files = fs.readdirSync(source).filter(name => /^package\.nls(?:\.[\w-]+)?\.json$/.test(name));
if (!files.includes('package.nls.json')) throw new Error('Missing default manifest translations');
for (const name of files) {
  JSON.parse(fs.readFileSync(path.join(source, name), 'utf8'));
  fs.copyFileSync(path.join(source, name), path.join(root, name));
}
// Only remove obsolete generated locale files, never unrelated root files.
for (const name of fs.readdirSync(root)) {
  if (/^package\.nls(?:\.[\w-]+)?\.json$/.test(name) && !files.includes(name)) fs.unlinkSync(path.join(root, name));
}
console.log(`Prepared ${files.length} manifest translation files`);
