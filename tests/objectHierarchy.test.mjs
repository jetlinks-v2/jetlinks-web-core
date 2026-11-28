import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

const module = { exports: {} }
new Function('module', 'exports', transformSync(readFileSync(new URL('../src/object-capability/hierarchy.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(module, module.exports)

test('only explicit, complete hierarchy descriptors opt into directory mode', () => {
  const { objectHierarchy } = module.exports
  for (const hierarchy of [undefined, null, {}, 'parentId', { parentProperty: 'parentId' }, { parentProperty: '', sortProperty: 'sortIndex' }, { parentProperty: 'parentId', sortProperty: ' ' }])
    assert.equal(objectHierarchy({ hierarchy }), undefined)
  assert.equal(objectHierarchy({ parentId: 'not a declaration' }), undefined)
  assert.deepEqual(objectHierarchy({ hierarchy: { parentProperty: 'owner', sortProperty: 'rank' } }), { parentProperty: 'owner', sortProperty: 'rank' })
})
