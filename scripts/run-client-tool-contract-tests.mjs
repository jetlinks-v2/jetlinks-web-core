import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
// Keep external dependencies resolvable from this package, and report only production code.
const outputDirectory = await mkdtemp(path.join(packageRoot, '.client-tool-tests-'))
const testEntries = ['clientToolContract', 'clientToolPreparation']
  .map(name => path.join(packageRoot, `tests/${name}.test.ts`))
// Exported production entries prevent bundler tree-shaking from hiding untested public helpers.
const testSource = (await Promise.all(testEntries.map(entry => readFile(entry, 'utf8')))).join('\n')
const productionEntries = [...new Set([...testSource.matchAll(/from\s+['"]\.\.\/(src\/[^'"]+)['"]/g)]
  .map(match => match[1]))]
const entryPoints = Object.fromEntries([
  ...testEntries.map(entry => [`tests/${path.basename(entry, '.ts')}`, entry]),
  ...productionEntries.map(entry => [entry.replace(/\.ts$/, ''), path.join(packageRoot, entry)]),
])
const outputFiles = testEntries.map(entry => path.join(outputDirectory, `tests/${path.basename(entry, '.ts')}.mjs`))

try {
  await build({
    entryPoints,
    outdir: outputDirectory,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    splitting: true,
    chunkNames: 'src/chunks/[name]-[hash]',
    packages: 'external',
    plugins: [{
      name: 'node-compatible-commonjs-subpaths',
      setup(builder) {
        builder.onResolve({ filter: /^(?:crypto-js\/|@jetlinks-web\/vite\/dist\/)/ }, args => ({
          path: require.resolve(args.path), external: true,
        }))
      },
    }, {
      name: 'client-tool-test-i18n',
      setup(builder) {
        builder.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({
          path: 'test-i18n', namespace: 'client-tool-test',
        }))
        builder.onLoad({ filter: /.*/, namespace: 'client-tool-test' }, () => ({
          contents: 'export default { global: { t: (key) => key } }', loader: 'js',
        }))
      },
    }],
    platform: 'node',
    format: 'esm',
    target: 'node22',
    define: {
      'import.meta.env': '{}',
      'import.meta.glob': '__testImportMetaGlob',
    },
    banner: {
      js: 'const __testImportMetaGlob = () => ({}); globalThis.window ??= globalThis; globalThis.window.addEventListener ??= () => undefined; globalThis.window.removeEventListener ??= () => undefined; globalThis.localStorage ??= { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; globalThis.navigator ??= { language: "en" };',
    },
    sourcemap: 'inline',
    logLevel: 'warning',
  })
  // V8's generated-code counters include bundler export wrappers. Remap to authored TS before enforcing gates.
  const result = spawnSync(process.execPath, [
    require.resolve('c8/bin/c8.js'),
    '--check-coverage',
    '--lines=90',
    '--branches=80',
    '--functions=85',
    '--exclude-after-remap',
    '--include=src/**',
    '--reporter=text',
    `--reports-dir=${path.join(outputDirectory, 'coverage')}`,
    process.execPath,
    '--test',
    ...outputFiles,
  ], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}
