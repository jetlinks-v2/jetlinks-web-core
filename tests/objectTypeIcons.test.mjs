import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const icons = require('@ant-design/icons-vue')
const compiled = await build({
  entryPoints: [new URL('../src/components/IconValue/objectTypeIcons.ts', import.meta.url).pathname],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs'
})
const module = { exports: {} }
new Function('module', 'exports', compiled.outputFiles[0].text)(module, module.exports)
const { getObjectTypeIcon, objectTypeIcons } = module.exports

test('semantic types have distinct, installed outline glyphs and one neutral fallback', () => {
  assert.equal(new Set(Object.values(objectTypeIcons)).size, Object.keys(objectTypeIcons).length)
  for (const [type, icon] of Object.entries(objectTypeIcons)) {
    assert.ok(icons[icon], `${type} must resolve to an installed icon`)
    assert.equal(getObjectTypeIcon(type), icon)
  }
  assert.notEqual(getObjectTypeIcon('org'), getObjectTypeIcon('space'))
  assert.notEqual(getObjectTypeIcon('device'), getObjectTypeIcon('deviceGroup'))
  for (const unknown of [undefined, '', 'customPump', '设备', 'toString', '__proto__']) {
    assert.equal(getObjectTypeIcon(unknown), 'AppstoreOutlined')
  }
  assert.equal(Object.isFrozen(objectTypeIcons), true)
})
