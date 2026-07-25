import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileString } from 'sass';

const themes = ['nord'];

function normalize(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .trim();
}

for (const theme of themes) {
  const scssUrl = new URL(`../src/styles/scss/${theme}.scss`, import.meta.url);
  const cssUrl = new URL(`../src/styles/css/${theme}.css`, import.meta.url);
  const [scss, checkedInCss] = await Promise.all([
    readFile(scssUrl, 'utf8'),
    readFile(cssUrl, 'utf8'),
  ]);
  const compiled = compileString(scss, { style: 'expanded' }).css;

  assert.equal(
    normalize(checkedInCss),
    normalize(compiled),
    `${theme}.css is stale. Run npm run css:build and commit the result.`,
  );
  console.log(`CSS is in sync: ${theme}`);
}
