import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const pluginDirectory = dirname(fileURLToPath(import.meta.url));
const testDirectory = await mkdtemp(join(pluginDirectory, '.test-'));
const pluginBundle = join(testDirectory, 'monaco-editor-plugin.mjs');

await build({
  entryPoints: [join(pluginDirectory, 'index.ts')],
  bundle: true,
  external: ['esbuild', 'vite'],
  format: 'esm',
  outfile: pluginBundle,
  platform: 'node',
});

const { default: monacoEditorPlugin } = await import(
  pathToFileURL(pluginBundle).href
);

after(async () => {
  await rm(testDirectory, { force: true, recursive: true });
});

const createResolvedConfig = (root, base = '/project/') => ({
  base,
  build: {
    outDir: 'dist',
  },
  root,
});

test('keeps the Vite base in Monaco worker URLs', () => {
  const plugin = monacoEditorPlugin({
    customWorkers: [],
    languageWorkers: ['editorWorkerService'],
  });

  plugin.configResolved(createResolvedConfig(testDirectory));
  const tags = plugin.transformIndexHtml('');
  const script = tags[0].children;

  assert.match(
    script,
    /\/project\/monacoeditorwork\/editor\.worker\.bundle\.js/,
  );
});

test('writes Monaco workers directly under build.outDir', () => {
  const outputRoot = join(testDirectory, 'physical-output');
  const plugin = monacoEditorPlugin({
    customWorkers: [],
    languageWorkers: [],
  });

  plugin.configResolved(createResolvedConfig(outputRoot));
  plugin.writeBundle();

  assert.equal(
    existsSync(join(outputRoot, 'dist', 'monacoeditorwork')),
    true,
  );
  assert.equal(
    existsSync(join(outputRoot, 'dist', 'project', 'monacoeditorwork')),
    false,
  );
});
