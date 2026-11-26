import assert from 'node:assert/strict'
import { createValueUnitRegistry } from '../../src/hooks/useValueUnit'
import type { DataCapabilityRequest } from '../../src/data-capability/types'

let reads = 0, fail = true
const registry = createValueUnitRegistry({
  get: async () => {
    reads++
    if (fail) throw new Error('unavailable')
    return { status: 200, result: [{ id: 'percent', symbol: '%' }, { id: 'none', symbol: '' }] }
  },
} as unknown as DataCapabilityRequest)
await Promise.all([registry.load(), registry.load()])
assert.equal(reads, 1)
assert.equal(registry.format('percent'), 'percent', 'dictionary failure preserves metadata text')
fail = false
await Promise.all([registry.load(), registry.load()])
assert.equal(reads, 2)
assert.equal(registry.format('percent'), '%')
assert.equal(registry.format('none'), '', 'an empty registered symbol does not expose its ID')
assert.equal(registry.format('custom-unit'), 'custom-unit')
await registry.load()
assert.equal(reads, 2)
const other = createValueUnitRegistry({ get: async () => ({ status: 200, result: [{ id: 'percent', symbol: 'pct' }] }) } as unknown as DataCapabilityRequest)
await other.load()
assert.equal(other.format('percent'), 'pct')
assert.equal(registry.format('percent'), '%', 'different host clients do not share dictionaries')
console.log('valueUnit: shared reads, retry, host isolation, unknown and empty symbols passed')
