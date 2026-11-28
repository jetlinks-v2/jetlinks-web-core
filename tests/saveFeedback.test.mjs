import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, reactive, nextTick } from 'vue'
import { createComponentLoader } from './helpers/componentRuntime.mjs'

const { useSaveFeedback } = createComponentLoader()('components/Editable/useSaveFeedback.ts')

test('shared feedback resets on cancellation, disabling and disposal, and releases pending timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const flags = reactive({ enabled: true, saving: false, dirty: true })
  const scope = effectScope()
  const state = scope.run(() => useSaveFeedback({ enabled: () => flags.enabled, saving: () => flags.saving, dirty: () => flags.dirty }))
  assert.equal(state.feedback.value, 'unsaved')
  flags.saving = true
  const pending = state.minimumFeedback()
  assert.equal(state.feedback.value, 'saving')
  t.mock.timers.tick(500); await pending
  state.markSaved(); flags.saving = false; flags.dirty = false
  assert.equal(state.feedback.value, 'saved')
  t.mock.timers.tick(2000)
  assert.equal(state.feedback.value, '')
  state.markSaved(); state.resetFeedback()
  assert.equal(state.feedback.value, '')
  state.markSaved(); flags.enabled = false; await nextTick()
  flags.enabled = true; await nextTick()
  assert.equal(state.feedback.value, '')
  const interrupted = state.minimumFeedback()
  scope.stop(); await interrupted
  state.markSaved()
  assert.equal(state.feedback.value, '')
})
