import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'jetlinks-client-tool-tests-'))
const outputFile = path.join(outputDirectory, 'clientToolContract.test.mjs')

try {
  await build({
    entryPoints: [path.join(packageRoot, 'tests/clientToolContract.test.ts')],
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: 'inline',
    logLevel: 'warning',
  })
  const result = spawnSync(process.execPath, [
    '--test',
    '--experimental-test-coverage',
    '--test-coverage-lines=90',
    '--test-coverage-branches=80',
    '--test-coverage-functions=85',
    outputFile,
  ], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  process.exitCode = result.status ?? 1
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}
