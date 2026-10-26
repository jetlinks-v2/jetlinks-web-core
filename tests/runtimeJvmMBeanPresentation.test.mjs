import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, compileScript, compileStyle, compileTemplate } from 'vue/compiler-sfc'

const root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics')
const components = [
  'JvmDiagnosticPanel.vue', 'ThreadViewer.vue', 'FlameGraphViewer.vue', 'AllocationRanking.vue',
  'MBeanBrowser.vue', 'MBeanAttributes.vue', 'MBeanSummary.vue', 'mbean/MBeanOperations.vue', 'buffer/BufferQueueDetail.vue',
]

test('JVM and MBean presentation components compile with compact local modes', () => {
  for (const name of components) {
    const filename = resolve(root, name), source = readFileSync(filename, 'utf8'), { descriptor, errors } = parse(source, { filename })
    assert.deepEqual(errors, [], name)
    assert.ok(compileScript(descriptor, { id: `jvm-mbean-${name}` }).content, name)
    assert.deepEqual(compileTemplate({ id: `jvm-mbean-${name}`, filename, source: descriptor.template?.content ?? '' }).errors, [], name)
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: `jvm-mbean-${name}`, filename, source: style.content, scoped: style.scoped }).errors, [], name)
  }
})

test('compact local tabs, text refresh and no-sample affordances keep their scoped contracts', () => {
  const jvm = readFileSync(resolve(root, 'JvmDiagnosticPanel.vue'), 'utf8')
  const flame = readFileSync(resolve(root, 'FlameGraphViewer.vue'), 'utf8')
  const mbean = readFileSync(resolve(root, 'MBeanBrowser.vue'), 'utf8')
  const buffer = readFileSync(resolve(root, 'buffer/BufferQueueDetail.vue'), 'utf8')
  assert.match(jvm, /diagnostics-mode-tabs/); assert.match(jvm, /active\?: boolean/); assert.match(jvm, /onMoreOpen/)
  assert.match(jvm, /@keydown\.esc\.stop="closeMore"/); assert.match(jvm, /getPopupDomNode/); assert.match(jvm, /createVisiblePopupFocus/); assert.match(jvm, /onMoreTriggerKeydown/)
  assert.match(jvm, /onDeactivated/); assert.match(jvm, /onBeforeUnmount/); assert.match(jvm, /watch\(moreOpen, open => \{ if \(!open\) popupFocus\.cancel\(\) \}/)
  assert.match(jvm, /class="jvm-tab-actions"/); assert.ok(!jvm.includes('class="jvm-actions diagnostics-compact-toolbar"'))
  assert.match(jvm, /template #sampling-details/); assert.match(jvm, /class="jvm-sampling-feedback"/)
  assert.match(flame, /v-if="layout\.total"/); assert.match(flame, /class="flame-search"/); assert.match(flame, /trigger="click"/); assert.match(flame, /detailsOpen/); assert.match(flame, /InfoCircleOutlined/)
  assert.match(mbean, /type="text" size="small" :aria-label="t\('runtimeDiagnostics\.refresh'\)"/); assert.match(mbean, /diagnostics-mode-tabs/)
  assert.match(buffer, /grid-template-columns:minmax\(0,1fr\) auto/); assert.ok(!buffer.includes('font-size:25px'))
})

test('idle and thread empty states use remaining diagnostic height for one central primary action', () => {
  const jvm = readFileSync(resolve(root, 'JvmDiagnosticPanel.vue'), 'utf8'), threads = readFileSync(resolve(root, 'ThreadViewer.vue'), 'utf8')
  assert.match(jvm, /hasDisplaySamples/); assert.match(jvm, /class="jvm-sampling-empty"/); assert.match(jvm, /flex:1 1 0/); assert.match(jvm, /min-width:160px/)
  assert.match(threads, /v-if="!threads\.length" class="thread-empty"/); assert.match(threads, /const canSample/); assert.match(threads, /flex:1 1 0/)
})
