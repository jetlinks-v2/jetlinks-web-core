import assert from 'node:assert/strict'
import test from 'node:test'
import { computed, effectScope, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'

const { useResponsivePanel } = createDashboardLoader()('components/Splitter/useResponsivePanel.ts')

function panel(collapsed = false, narrow = false) {
  const scope = effectScope(), preference = ref(collapsed), compact = ref(narrow)
  const state = scope.run(() => useResponsivePanel(preference, compact))
  return { preference, compact, state, stop: () => scope.stop() }
}

test('automatic collapse and temporary drawer actions preserve the wide-layout preference', t => {
  const view = panel(); t.after(view.stop)
  view.compact.value = true
  assert.equal(view.state.inlineCollapsed.value, true)
  assert.equal(view.state.collapsed.value, true)
  assert.equal(view.preference.value, false)
  view.state.toggle()
  assert.equal(view.state.overlayOpen.value, true)
  assert.equal(view.state.collapsed.value, false)
  assert.equal(view.state.inlineCollapsed.value, true)
  view.state.close()
  assert.equal(view.preference.value, false)
  view.compact.value = false
  assert.equal(view.state.inlineCollapsed.value, false)
})

test('manual collapse survives narrow-layout opening and automatic expansion never opens a drawer', t => {
  const view = panel(); t.after(view.stop)
  view.state.toggle()
  assert.equal(view.preference.value, true)
  view.compact.value = true
  view.state.setCollapsed(false)
  assert.equal(view.state.overlayOpen.value, true)
  view.compact.value = false
  assert.equal(view.state.overlayOpen.value, false)
  assert.equal(view.state.collapsed.value, true)
  view.compact.value = true
  assert.equal(view.state.overlayOpen.value, false)
})

test('controlled preference requests may be rejected without changing the rendered wide layout', t => {
  const scope = effectScope(); t.after(() => scope.stop())
  const requests = [], compact = ref(false)
  const preference = computed({ get: () => false, set: value => requests.push(value) })
  const state = scope.run(() => useResponsivePanel(preference, compact))
  state.toggle()
  assert.deepEqual(requests, [true])
  assert.equal(state.collapsed.value, false)
  compact.value = true
  state.toggle(); state.close()
  assert.deepEqual(requests, [true])
})

const gesture = (phase, requestedSize = 0) => ({ phase, requestedSize, initialSize: 0 })

test('edge dragging reveals temporarily, confirms at midpoint and permits returning to cancel', t => {
  const view = panel(true, true); t.after(view.stop)
  const drag = (phase, size) => view.state.drag(gesture(phase, size), 160)
  drag('start'); drag('move', 40)
  assert.equal(view.state.revealSize.value, 40)
  assert.equal(view.state.overlayOpen.value, false)
  assert.equal(view.state.revealIntent.value, false)
  drag('move', 81); drag('move', 70)
  assert.equal(view.state.revealIntent.value, true)
  drag('move', 64); drag('end', 64)
  assert.equal(view.state.overlayOpen.value, false)
  assert.equal(view.state.revealSize.value, undefined)
  drag('start'); drag('move', 100); drag('end', 100)
  assert.equal(view.state.overlayOpen.value, true)
  assert.equal(view.state.revealSize.value, undefined)
  assert.equal(view.preference.value, true)
})

test('cancel, dismissal and layout changes invalidate a reveal without changing user preference', t => {
  const view = panel(false, true); t.after(view.stop)
  const drag = (phase, size) => view.state.drag(gesture(phase, size), 200)
  for (const cancel of [() => drag('cancel'), () => view.state.close(), () => { view.compact.value = false }]) {
    view.compact.value = true
    drag('start'); drag('move', 140)
    cancel(); drag('end', 140)
    assert.equal(view.state.overlayOpen.value, false)
    assert.equal(view.state.revealSize.value, undefined)
    assert.equal(view.preference.value, false)
  }
  view.compact.value = true
  drag('start'); drag('move', -20)
  assert.equal(view.state.revealSize.value, 0)
  drag('move', 300)
  assert.equal(view.state.revealSize.value, 200)
})
