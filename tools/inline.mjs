// Post-build: inline JS + CSS (fonts are already data: URIs) into one HTML file.
//   node tools/inline.mjs standalone  -> dist/phony-business.html (full document)
//   node tools/inline.mjs artifact    -> dist-artifact/artifact.html (claude.ai page body)
import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2] || 'standalone';
const dir = mode === 'artifact' ? 'dist-artifact' : 'dist';
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const read = (href) => fs.readFileSync(path.join(dir, href.replace(/^\.\//, '')), 'utf8');

const styles = [];
let rest = html.replace(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  styles.push(`<style>${read(href)}</style>`);
  return '';
});
const scripts = [];
rest = rest.replace(/<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  scripts.push(`<script type="module">${read(src).replace(/<\/script/gi, '<\\/script')}</script>`);
  return '';
});

let out;
if (mode === 'artifact') {
  const title = (rest.match(/<title>[\s\S]*?<\/title>/) || ['<title>Phony Business</title>'])[0];
  const body = (rest.match(/<body[^>]*>([\s\S]*)<\/body>/) || ['', ''])[1].trim();
  out = [title, ...styles, body, ...scripts].join('\n');
  fs.writeFileSync(path.join(dir, 'artifact.html'), out);
} else {
  // function replacers: minified code contains `$'` sequences that string replacers would expand
  out = rest.replace('</head>', () => styles.join('\n') + '\n</head>').replace('</body>', () => scripts.join('\n') + '\n</body>');
  fs.writeFileSync(path.join(dir, 'phony-business.html'), out);
}
console.log(`[inline] ${mode}: ${(Buffer.byteLength(out) / 1048576).toFixed(2)} MB`);
