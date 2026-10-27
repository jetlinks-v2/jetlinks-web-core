import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSync } from 'esbuild'
import { resolve } from 'node:path'
import vm from 'node:vm'

function load(name) {
  const built = buildSync({ entryPoints: [resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics', name)], bundle: true, format: 'cjs', platform: 'node', minify: true, write: false })
  const module = { exports: {} }; new Function('module', 'exports', built.outputFiles[0].text)(module, module.exports)
  return module.exports
}
const { createJvmDiagnosticHtml } = load('jvmDiagnosticHtml.ts')
const report = { title: 'Report', savePdf: 'Print', exportedAt: 'Exported', range: 'Range', notCollected: 'Not collected', boundary: 'Frozen evidence', threads: 'Threads', flame: 'Flame', frames: 'Frames', allocations: 'Allocations', method: 'Method', samples: 'Samples', parent: 'Parent', bytes: 'Bytes', state: 'Stopped', all: 'All', formatTime: value => `time:${value}`, threadFields: { lock: 'Lock', lockOwner: 'Owner', blockedCount: 'Blocked', blockedTime: 'Blocked time', waitedCount: 'Waited', waitedTime: 'Waited time', inNative: 'Native', suspended: 'Suspended' } }
const interaction = { live: 'Analysis', snapshots: 'Snapshots', offline: 'Offline', details: 'About', allocationSearch: 'Find type', threadSearch: 'Find thread', allocations: 'Allocations', allocationHint: 'Recorded bytes', thread: 'Threads', state: 'State', stackDepth: 'Depth', name: 'Name', bytes: 'Bytes', share: 'Share', all: 'All', noMatches: 'No matches', noStack: 'No stack', loadMore: 'More', notCollected: 'Not collected', unavailable: 'Unavailable', noExecutionSamples: 'No execution samples', noAllocationSamples: 'No allocation samples', noThreads: 'No threads', scriptRequired: 'Enable JavaScript', threadFields: report.threadFields }
const options = { report, interaction }
const data = () => ({ version: 1, nodeId: 'iot:8200', exportedAt: 100, sampling: { status: 'stopped' }, threadState: { status: 'ready' },
  snapshot: { startedAt: 10, sampledAt: 20, flameGraph: [{ className: 'org.jetlinks.Test', method: 'work', samples: 100 }], objectAllocations: Array.from({ length: 304 }, (_, i) => ({ className: `types.Class${String(i).padStart(3, '0')}`, allocationSize: i + 1 })) },
  threads: Array.from({ length: 145 }, (_, i) => ({ id: String(i), name: `worker-${i}`, state: i % 2 ? 'BLOCKED' : 'RUNNABLE', stack: Array.from({ length: i + 1 }, (_, n) => `frame.${n}`).join('\n'), sampledAt: 12, blockedCount: 4, blockedTime: -1 })) })

function mount(evidence = data()) {
  const html = createJvmDiagnosticHtml(evidence, options), scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  const payload = JSON.parse(scripts.at(-2)[1])
  class Element {
    children = []; dataset = {}; attributes = {}; value = ''; textContent = ''; hidden = false; tabIndex = 0; scrollTop = 0; isConnected = true; details = []; classes = new Set()
    classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) }
    setAttribute(name, value) { this.attributes[name] = value }
    getAttribute(name) { return this.attributes[name] }
    append(child) { this.children.push(child) }
    focus() { this.focused = true }
    set innerHTML(value) {
      this.html = value; this.details.forEach(item => { item.isConnected = false })
      this.details = [...value.matchAll(/<details[^>]*data-key="(\d+)"([^>]*)>/g)].map(match => Object.assign(new Element(), { dataset: { key: match[1] }, open: match[2].includes('open') }))
    }
    get innerHTML() { return this.html ?? '' }
    querySelectorAll() { return this.details }
  }
  const ids = ['allocation-rows', 'allocation-search', 'allocation-count', 'allocation-more', 'allocation-sort', 'thread-rows', 'thread-search', 'thread-more', 'thread-count', 'thread-sort', 'thread-states', 'diagnostic-live', 'diagnostic-snapshots']
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]))
  const tabs = ['diagnostic-live', 'diagnostic-snapshots'].map(id => { const tab = new Element(); tab.setAttribute('aria-controls', id); return tab })
  const root = { querySelector: id => elements[id.slice(1)], querySelectorAll: () => tabs }
  const document = { getElementById: id => id === 'diagnostic-report' ? root : { textContent: JSON.stringify(payload) }, createElement: () => new Element() }
  vm.runInNewContext(scripts.at(-1)[1], { document })
  return { html, elements, tabs, payload }
}

test('minified report retains all frozen evidence, escapes script terminators and has no remote resources', () => {
  const source = data(), hostile = '</script><img src=x onerror=alert(1)>'
  source.nodeId = hostile; source.threads.at(-1).name = hostile; source.threads.at(-1).stack += hostile
  source.snapshot.objectAllocations.at(-1).className = hostile
  const before = JSON.stringify(source), h = mount(source)
  assert.equal(JSON.stringify(h.payload.data), before); assert.equal(JSON.stringify(source), before)
  assert.equal(h.payload.data.threads.length, 145); assert.equal(h.payload.data.snapshot.objectAllocations.length, 304)
  assert.ok(!h.html.includes(hostile)); assert.ok(h.html.includes('\\u003c/script>'))
  assert.ok(!/<(?:script|link|img|iframe)\b[^>]*(?:src|href)=/i.test(h.html))
  assert.match(h.html, /default-src 'none'/)
  h.elements['thread-search'].value = '<img'; h.elements['thread-search'].oninput()
  assert.match(h.elements['thread-rows'].innerHTML, /&lt;img/); assert.ok(!h.elements['thread-rows'].innerHTML.includes('<img'))
})

test('allocation search includes initially unrendered rows and keeps the full evidence denominator', () => {
  const h = mount(), ui = h.elements
  assert.equal((ui['allocation-rows'].innerHTML.match(/<li /g) ?? []).length, 100)
  assert.equal(ui['allocation-more'].hidden, false)
  ui['allocation-more'].onclick()
  assert.equal((ui['allocation-rows'].innerHTML.match(/<li /g) ?? []).length, 200)
  ui['allocation-search'].value = 'Class000'; ui['allocation-search'].oninput()
  assert.match(ui['allocation-rows'].innerHTML, /Class000/); assert.match(ui['allocation-rows'].innerHTML, /&lt;0.1%/)
  assert.equal(ui['allocation-more'].hidden, true)
  ui['allocation-search'].value = ''; ui['allocation-search'].oninput(); ui['allocation-sort'].onclick()
  assert.ok(ui['allocation-rows'].innerHTML.indexOf('Class000') < ui['allocation-rows'].innerHTML.indexOf('Class001'))
})

test('threads default to deepest stacks, keep expansion through filtering and reach every row without pagination', () => {
  const h = mount(), ui = h.elements
  assert.ok(ui['thread-rows'].innerHTML.indexOf('worker-144') < ui['thread-rows'].innerHTML.indexOf('worker-143'))
  assert.equal(ui['thread-rows'].details.length, 60)
  const first = ui['thread-rows'].details[0]; first.open = true; first.ontoggle()
  ui['thread-search'].value = 'missing'; ui['thread-search'].oninput(); assert.match(ui['thread-rows'].innerHTML, /No matches/)
  ui['thread-search'].value = ''; ui['thread-search'].oninput(); assert.equal(ui['thread-rows'].details[0].open, true)
  ui['thread-more'].onclick(); ui['thread-more'].onclick(); assert.equal(ui['thread-rows'].details.length, 145)
  ui['thread-states'].children.find(button => button.dataset.state === 'BLOCKED').onclick()
  assert.ok(!ui['thread-rows'].innerHTML.includes('is-runnable')); assert.match(ui['thread-count'].textContent, /72 \/ 145/)
  assert.match(ui['thread-rows'].innerHTML, /Blocked time<\/dt><dd>Not collected/)
})

test('tabs preserve independent controls, support keyboard navigation and thread-only reports open on snapshots', () => {
  const h = mount(), ui = h.elements
  ui['allocation-search'].value = 'Class'
  h.tabs[1].onclick(); assert.equal(ui['diagnostic-live'].hidden, true)
  h.tabs[1].onkeydown({ key: 'ArrowRight', preventDefault() {} }); assert.equal(h.tabs[0].focused, true)
  assert.equal(ui['allocation-search'].value, 'Class'); assert.equal(ui['diagnostic-live'].hidden, false)
  const threadsOnly = data(); delete threadsOnly.snapshot
  const other = mount(threadsOnly)
  assert.equal(other.elements['diagnostic-snapshots'].hidden, false)
  assert.match(other.elements['allocation-rows'].innerHTML, /Not collected/)
})

test('allocation-only, empty and unavailable snapshots do not fabricate execution or thread evidence', () => {
  const source = data(); source.snapshot.flameGraph = []; source.threads = []; source.threadState = { status: 'forbidden' }
  const h = mount(source)
  assert.match(h.html, /No execution samples/); assert.ok(!h.html.includes('id="flame-export"'))
  assert.match(h.elements['thread-rows'].innerHTML, /Unavailable/)
  assert.ok(h.payload.data.snapshot.objectAllocations.length > 0)
  source.threadState = { status: 'empty' }
  assert.match(mount(source).elements['thread-rows'].innerHTML, /No threads/)
})
