import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import * as vue from 'vue'
import { createComponentLoader } from './helpers/componentRuntime.mjs'

const route = vue.reactive({ name: 'outlined', path: '/outlined', matched: [] })
const variant = vue.ref('project')
const load = createComponentLoader({
  'vue-router': { useRoute: () => route },
  './useBasicLayoutVariant': { useBasicLayoutVariant: () => variant },
  '../runtime/contentPanelOverrides': { resolveContentPanelOverride: keys => keys.includes('outlined') ? { padding: 0, bordered: true } : keys.includes('disabled') ? false : undefined },
})
const { normalizeContentPanel, useRouteContentPanel } = load(fileURLToPath(new URL('../src/layout/hooks/useRouteContentPanel.ts', import.meta.url)))

test('thin workspace outlines are explicit and retain padding/background semantics', () => {
  for (const declared of [undefined, true, false, { padding: 0 }]) assert.equal(normalizeContentPanel(declared).bordered ?? false, false)
  const outlined = normalizeContentPanel({ bordered: true, background: false, padding: 0 })
  assert.equal(outlined.bordered, true)
  assert.equal(outlined.background, false)
  assert.equal(outlined.padding, 0)
})

test('route and layout changes cannot leak an outlined panel to the next page', () => {
  const panel = useRouteContentPanel()
  assert.equal(panel.value.bordered, true)
  route.name = 'legacy'; route.path = '/legacy'
  assert.equal(panel.value.bordered ?? false, false)
  route.name = 'disabled'
  assert.equal(panel.value.enabled, false)
  route.name = 'outlined'
  assert.equal(panel.value.bordered, true)
  variant.value = 'tenant'
  assert.equal(panel.value.enabled, false)
  assert.equal(panel.value.bordered ?? false, false)
})
