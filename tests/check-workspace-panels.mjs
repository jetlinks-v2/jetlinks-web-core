import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repository = fileURLToPath(new URL('..', import.meta.url))
const temporary = mkdtempSync(join(tmpdir(), 'jetlinks-workspace-panels-types-'))
try {
  // Vue generates global declarations; keep them out of shared installed dependencies.
  symlinkSync(realpathSync(join(repository, 'node_modules')), join(temporary, 'node_modules'), 'junction')
  const config = join(temporary, 'tsconfig.json')
  writeFileSync(config, JSON.stringify({
    extends: resolve(repository, process.argv[2] || 'tests/tsconfig.workspace-panels.json'),
    vueCompilerOptions: { globalTypesPath: 'vue-global-types.d.ts' },
  }))
  const result = spawnSync(process.execPath, [join(repository, 'node_modules/vue-tsc/bin/vue-tsc.js'), '-p', config], { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
