import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'jetlinks-client-tool-preparation-tests-'))
const outputFile = path.join(outputDirectory, 'clientToolPreparation.test.mjs')

try {
  await build({
    entryPoints: [path.join(packageRoot, 'tests/clientToolPreparation.test.ts')],
    outfile: outputFile,
    bundle: true,
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
    plugins: [{
      name: 'client-tool-preparation-i18n',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({
          path: 'test-i18n',
          namespace: 'client-tool-preparation',
        }))
        buildApi.onLoad({
          filter: /.*/,
          namespace: 'client-tool-preparation',
        }, () => ({
          contents: 'export default { global: { t: (key) => key } }',
          loader: 'js',
        }))
      },
    }],
    sourcemap: 'inline',
    logLevel: 'warning',
  })
  const result = spawnSync(process.execPath, ['--test', outputFile], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  process.exitCode = result.status ?? 1
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}
