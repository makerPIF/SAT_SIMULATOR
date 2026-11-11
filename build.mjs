// 각 시뮬레이터의 src/app.js를 번들해 src/template.html에 넣고 index.html 한 파일로 만든다.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const apps = ['orbit-3d', 'cubesat-mission', 'cubesat-sizes', 'korea-gcs', 'nuri-payload'];
for (const app of apps) {
  const out = await build({
    entryPoints: [`${app}/src/app.js`], bundle: true, minify: true, format: 'iife',
    loader: { '.json': 'json' }, write: false,
  });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = readFileSync(`${app}/src/template.html`, 'utf8').replace('/*__BUNDLE__*/', () => js);
  writeFileSync(`${app}/index.html`, html);
  console.log(`✔ ${app}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
}
