import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const entries = [
  'tests/unit/dataCapabilityCore.spec.ts',
  'tests/unit/dataCapabilitySchema.spec.ts',
  'tests/unit/dataCapabilityLegacy.spec.ts',
  'tests/unit/dataCapabilityModuleRegistry.spec.ts',
  'tests/unit/dataCapabilityOutput.spec.ts',
  'tests/unit/dataCapabilityOptionSource.spec.ts',
]

const runNode = file => new Promise((resolvePromise, reject) => {
  const child = spawn(process.execPath, [file], {
    cwd: root,
    stdio: 'inherit',
  })
  child.once('error', reject)
  child.once('exit', (code, signal) => {
    if (code === 0) {
      resolvePromise()
      return
    }
    reject(new Error(`Data capability test exited with ${signal ? `signal ${signal}` : `code ${code}`}`))
  })
})

const outputDirectory = await mkdtemp(join(tmpdir(), 'jetlinks-data-capability-'))

try {
  for (const entry of entries) {
    const output = join(outputDirectory, `${basename(entry, '.ts')}.mjs`)
    await build({
      absWorkingDir: root,
      entryPoints: [entry],
      outfile: output,
      bundle: true,
      define: {
        'import.meta.env': '{}',
      },
      format: 'esm',
      logLevel: 'warning',
      platform: 'node',
      target: 'node22',
    })
    await runNode(output)
  }
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}
