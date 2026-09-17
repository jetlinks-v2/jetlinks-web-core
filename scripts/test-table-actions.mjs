import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))
const outputDirectory = await mkdtemp(join(tmpdir(), 'jetlinks-table-actions-'))
try {
  const outfile = join(outputDirectory, 'grouping.test.mjs')
  await build({
    absWorkingDir: root,
    entryPoints: ['tests/tableActions/grouping.test.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
  })
  await import(pathToFileURL(outfile).href)
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}
