// Bundle the app into single files:
//   dist/ep-simulator.html            page fragment for publishing as a Claude artifact (no <html>/<head>/<body>)
//   dist/ep-simulator-standalone.html the same thing as a complete document you can open directly
// Usage: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const between = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b); if (i < 0 || j < 0) throw new Error('marker missing: ' + a); return src.slice(i + a.length, j); };
let head = between('<!--ARTIFACT-HEAD-START-->', '<!--ARTIFACT-HEAD-END-->');
let body = between('<!--ARTIFACT-BODY-START-->', '<!--ARTIFACT-BODY-END-->');
const scriptsBlock = between('<!--ARTIFACT-SCRIPTS-START-->', '<!--ARTIFACT-SCRIPTS-END-->');
// inline stylesheet
head = head.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => '<style>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '\n</style>');
// inline local scripts
const files = [...scriptsBlock.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
let js = '';
for (const f of files) js += '\n/* ---- ' + f + ' ---- */\n' + fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n';
body = body.replace('<!--ARTIFACT-SCRIPTS-START-->' + scriptsBlock + '<!--ARTIFACT-SCRIPTS-END-->', '<script>' + js + '</script>');
const frag = head.trim() + '\n' + body.trim() + '\n';
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/ep-simulator.html'), frag);
fs.writeFileSync(path.join(root, 'dist/ep-simulator-standalone.html'), '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head.trim() + '\n</head>\n<body>\n' + body.trim() + '\n</body>\n</html>\n');
console.log('built', files.length, 'scripts →', (frag.length / 1024).toFixed(0) + ' KB');
