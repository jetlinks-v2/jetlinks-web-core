import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

const module = { exports: {} }
new Function('module', 'exports', transformSync(readFileSync(new URL('../src/hooks/Echarts/streamOption.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(module, module.exports)
export const { composeStreamOption } = module.exports
