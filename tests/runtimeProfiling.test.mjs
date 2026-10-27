import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSync } from 'esbuild'
import { resolve } from 'node:path'

function load(name) {
  const bundle = buildSync({ entryPoints: [resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics', name)], bundle: true, platform: 'node', format: 'cjs', write: false })
  const module = { exports: {} }
  new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports)
  return module.exports
}
const { buildFlameLayout, compactFlameLayout, renderFlameSvg } = load('flameGraph.ts')
const { createJvmDiagnosticReport } = load('jvmDiagnosticReport.ts')
const frame = (className, samples = 10, children = []) => ({ className, method: 'run', samples, children })

test('library folding is reversible, keeps platform boundaries and preserves the complete sample denominator', () => {
  const source = [frame('library.A', 10, [frame('library.B', 10, [frame('library.C', 10, [frame('org.jetlinks.Business')])])])]
  const full = buildFlameLayout(source), compact = compactFlameLayout(full)
  assert.equal(compact.depth, 2); assert.equal(compact.cells.length, 2)
  assert.deepEqual(compact.cells[0].foldedNames, ['library.B.run', 'library.C.run'])
  assert.equal(compact.total, full.total); assert.equal(compact.cells[1].platform, true)
  assert.deepEqual(compactFlameLayout(full, new Set([full.cells[0].key])).cells.map(value => [value.key, value.depth, value.width]), full.cells.map(value => [value.key, value.depth, value.width]))
  assert.equal(full.cells.length, 4, 'compaction never mutates the evidence tree')
})

test('folding never hides a branch, a category boundary or a change in inclusive samples', () => {
  const cases = [
    [frame('library.A', 10, [frame('library.B', 5), frame('library.C', 5)])],
    [frame('library.A', 10, [frame('io.netty.Channel', 10, [frame('io.netty.Handler')])])],
    [frame('library.A', 10, [frame('library.B', 8, [frame('library.C', 8)])])],
  ]
  for (const source of cases) {
    const full = buildFlameLayout(source), compact = compactFlameLayout(full)
    assert.equal(compact.cells[0].foldedNames, undefined)
    assert.equal(compact.total, 10)
  }
})

test('short labels are clipped within each SVG frame while full names remain accessible', () => {
  const name = 'example.long.package.ClassWithLongName'
  const svg = renderFlameSvg(buildFlameLayout([frame(name)]), { samples: 'samples', platform: 'Platform' }, 1500)
  assert.match(svg, /width="1500"/)
  assert.match(svg, /overflow="hidden"/)
  assert.match(svg, /ClassWithLongName.run<\/text>/)
  assert.ok(svg.includes(`<title>${name}.run`))
  assert.ok(!svg.includes(`>${name}.run</text>`))
})

const labels = { title: 'Diagnostic report', savePdf: 'Print', exportedAt: 'Exported', range: 'Range', notCollected: 'Not collected', boundary: 'Sampled evidence', threads: 'Threads', flame: 'Flame graph', frames: 'All frames', allocations: 'Allocations', method: 'Method', samples: 'Samples', parent: 'Parent', bytes: 'Bytes', state: 'Stopped', all: 'Root', formatTime: value => `time:${value}`, threadFields: { lock: 'Lock', lockOwner: 'Owner', blockedCount: 'Blocked count', blockedTime: 'Blocked time', waitedCount: 'Waited count', waitedTime: 'Waited time', inNative: 'Native', suspended: 'Suspended' } }
test('print report contains every deep frame, allocation and complete thread evidence with escaped text', () => {
  const hostile = '</script><img src=x onerror=alert(1)>'
  let root = frame('leaf.' + hostile)
  for (let i = 0; i < 35; i++) root = frame(`stack.Frame${i}`, 10, [root])
  const allocations = Array.from({ length: 75 }, (_, i) => ({ className: `allocation.Class${i}`, allocationSize: i * 1024 }))
  const data = { version: 1, nodeId: hostile, exportedAt: 1, threadState: { status: 'ready' }, sampling: { status: 'stopped' }, snapshot: { startedAt: 2, sampledAt: 3, flameGraph: [root], objectAllocations: allocations }, threads: [{ id: '1', name: hostile, state: 'BLOCKED', sampledAt: 4, stack: `at ${hostile}\n at source.LastLine`, lock: 'lock<1>', lockOwner: { id: '22', name: 'owner<2>' }, blockedCount: 3, blockedTime: 4, waitedCount: 5, waitedTime: -1, inNative: false, suspended: true }] }
  const before = JSON.stringify(data), report = createJvmDiagnosticReport(data, labels)
  assert.equal(JSON.stringify(data), before)
  assert.equal((report.match(/class="flame-page"/g) ?? []).length, 3)
  for (let i = 0; i < 35; i++) assert.ok(report.includes(`stack.Frame${i}.run`))
  for (let i = 0; i < 75; i++) assert.ok(report.includes(`allocation.Class${i}`))
  assert.match(report, /owner&lt;2&gt; #22/); assert.match(report, /Blocked time<\/dt><dd>4 ms/)
  assert.match(report, /Waited time<\/dt><dd>Not collected/); assert.match(report, /Native<\/dt><dd>false/)
  assert.match(report, /source.LastLine/); assert.ok(!report.includes(hostile))
  assert.ok(report.includes('break-before:page')); assert.ok(report.includes('table-header-group'))
})

test('report clearly marks missing collections and never invents a sampling interval', () => {
  const report = createJvmDiagnosticReport({ version: 1, nodeId: 'node', exportedAt: 1, threads: [], threadState: { status: 'empty' }, sampling: { status: 'idle' } }, labels)
  assert.ok(report.includes('Not collected')); assert.ok(!report.includes('time:0'))
  assert.equal((report.match(/class="flame-page"/g) ?? []).length, 0)
})
