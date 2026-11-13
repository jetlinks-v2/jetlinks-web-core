import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('vue/compiler-sfc')
const file = fileURLToPath(new URL('./setup-name.ts', import.meta.url))
const loaded = new Module(file)
loaded.paths = Module._nodeModulePaths(dirname(file))
loaded._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file)
const plugin = loaded.exports.setupNamePlugin()
const directory = mkdtempSync(join(tmpdir(), 'setup-name-'))
writeFileSync(join(directory, 'props.ts'), 'export interface Props { title: string; disabled?: boolean }')
after(() => rmSync(directory, { recursive: true, force: true }))

function compile(source, filename = join(directory, 'Example.vue')) {
  const transformed = plugin.transform(source, filename)
  const { descriptor, errors } = parse(transformed?.code || source, { filename })
  assert.deepEqual(errors, [])
  return { transformed, result: compileScript(descriptor, { id: filename }) }
}

test('unnamed setup leaves imported props to the official compiler', () => {
  const { transformed, result } = compile('<script setup lang="ts">import type { Props } from "./props"; defineProps<Props>()</script>')
  assert.equal(transformed, null)
  assert.match(result.content, /title:.*required: true/)
})

test('legacy names preserve TypeScript and imported props without compiling them early', () => {
  const source = '<script setup lang="ts" name="NamedExample">import type { Props } from "./props"; defineProps<Props>()</script>'
  const { transformed, result } = compile(source)
  assert.ok(transformed.code.startsWith(source))
  assert.match(transformed.code, /<script lang="ts">/)
  assert.match(result.content, /name: "NamedExample"/)
  assert.match(result.content, /title:.*required: true/)
})

test('an existing normal script and native defineOptions retain precedence', () => {
  const { transformed, result } = compile('<script lang="ts">export default {name:"Existing"}</script><script setup lang="ts" name="Ignored">import type { Props } from "./props"; defineProps<Props>()</script>')
  assert.equal(transformed, null)
  assert.match(result.content, /name:"Existing"/)
  const native = compile('<script setup lang="ts" name="Legacy">defineOptions({name:"Native"})</script>').result
  assert.match(native.content, /name:"Native"/)
})

test('only complete Vue files are processed and names cannot create script tags', () => {
  assert.equal(plugin.transform('<script setup name="Ignored"/>', 'Example.vue?vue&type=script'), null)
  const { transformed } = compile('<script setup name="Quoted &lt;/script&gt;">const count=0</script>')
  const { descriptor, errors } = parse(transformed.code)
  assert.deepEqual(errors, [])
  assert.ok(descriptor.script)
  assert.ok(descriptor.scriptSetup)
  assert.match(descriptor.script.content, /\\u003c/)
})

test('real shared formula components compile through the naming and Vue compiler chain', () => {
  const root = resolve(dirname(file), '../..')
  for (const path of [
    'src/components/Expression/ExpressionTrial.vue',
    'src/components/Expression/MathExpressionEditor.vue',
  ]) {
    const filename = join(root, path)
    const { result } = compile(readFileSync(filename, 'utf8'), filename)
    assert.ok(result.content.includes('props:'))
  }
})

test('Vite configuration uses the compatible naming plugin', () => {
  const config = readFileSync(resolve(dirname(file), '../../vite.config.ts'), 'utf8')
  assert.match(config, /setupNamePlugin\(\)/)
  assert.doesNotMatch(config, /vite-plugin-vue-setup-extend/)
})
