import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'jetlinks-application-access-tests-'))
const outputFile = path.join(outputDirectory, 'application-access.test.mjs')

try {
  await build({
    entryPoints: [path.join(packageRoot, 'scripts/test-application-access.mjs')],
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    define: {
      'import.meta.env': JSON.stringify({
        BASE_URL: '/',
        VITE_APP_ENVIRONMENT: 'cloud',
        VITE_APP_RUNTIME_SCOPE: 'auto',
        VITE_TOKEN_KEY: 'X-Access-Token',
      }),
    },
    sourcemap: 'inline',
    logLevel: 'warning',
  })

  const result = spawnSync(process.execPath, [outputFile], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  process.exitCode = result.status ?? 1
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}
