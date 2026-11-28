import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'

test('overflow floats only while editing and keeps portaled option editing open', async t => {
  const callbacks = []
  const load = createDashboardLoader({ '@vueuse/core': { useResizeObserver: (_, callback) => callbacks.push(callback) } })
  const { useConditionOverflow } = load('components/ConditionFilter/useConditionOverflow.ts')
  const scope = effectScope(), enabled = ref(false), panelsOpen = ref(false), label = ref('条件')
  const content = ref({ clientWidth: 240, scrollWidth: 600 }), shell = ref({ contains: () => false, querySelector: () => null })
  const state = scope.run(() => useConditionOverflow({ enabled, content, shell, label, panelsOpen }))
  t.after(() => scope.stop())
  await nextTick()
  assert.equal(state.showSummary.value, false)
  enabled.value = true; await nextTick(); await nextTick()
  assert.equal(state.showSummary.value, true)
  state.focused.value = true; await nextTick()
  assert.equal(state.expanded.value, true)
  content.value.scrollWidth = 240; callbacks[0](); await nextTick()
  assert.equal(state.expanded.value, true)
  panelsOpen.value = true; state.focusOut({ relatedTarget: {} }); await nextTick()
  assert.equal(state.expanded.value, true)
  panelsOpen.value = false; await nextTick(); await nextTick()
  assert.equal(state.expanded.value, false)
  assert.equal(state.showSummary.value, false)
})
