import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/components/VirtualScroll/range.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs'
})
const loaded = { exports: {} }
new Function('module', 'exports', result.outputFiles[0].text)(loaded, loaded.exports)
const { virtualRange, virtualRowOffset } = loaded.exports

test('fixed summaries preserve the original virtual range and empty boundaries', () => {
  assert.deepEqual(virtualRange(1000, 72, 7200, 360), { start: 100, end: 107, offset: 7200, total: 72000 })
  assert.deepEqual(virtualRange(0, 72, 0, 360), { start: 0, end: 0, offset: 0, total: 0 })
  assert.equal(virtualRange(3, 72, 1000, 360).start, 2)
  assert.equal(virtualRange(3, 72, 0, 360).end, 3)
})

test('an expanded row remains rendered while reading its measured details and later rows retain their positions', () => {
  const range = virtualRange(1000, 72, 7200 + 130, 360, 100, 400)
  assert.equal(range.start, 100)
  assert.equal(range.offset, 7200)
  assert.equal(range.total, 72400)
  assert.equal(virtualRange(1000, 72, 7200 + 471, 360, 100, 400).start, 100)
  assert.equal(virtualRange(1000, 72, 7200 + 472, 360, 100, 400).start, 101)
  assert.equal(virtualRowOffset(101, 72, 100, 400), 7672)
  assert.equal(virtualRange(1000, 72, 7672, 360, 100, 400).offset, 7672)
})

test('closing or switching an expansion preserves the visible summary anchor without rendering all records', () => {
  const before = virtualRange(1000, 72, 36000 + 180, 360, 100, 160)
  const within = 36180 - before.offset
  const closedTop = virtualRowOffset(before.start, 72) + within
  const after = virtualRange(1000, 72, closedTop, 360)
  assert.equal(before.start, after.start)
  assert.equal(closedTop - after.offset, within)
  assert(after.end - after.start < 10)
  const switchedTop = virtualRowOffset(before.start, 72, 900, 160) + within
  assert.equal(virtualRange(1000, 72, switchedTop, 360, 900, 160).start, before.start)
})
