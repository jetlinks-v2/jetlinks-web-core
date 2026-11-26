import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer, walk } from './helpers/componentRuntime.mjs'

test('PageHeader dispatches back to the host listener or falls back to the router after setup', () => {
  for (const listens of [true, false]) {
    let emitted = 0, routed = 0
    const Component = createDashboardLoader({ 'vue-router': { useRouter: () => ({ back: () => routed++ }) } })('components/PageHeader/index.vue').default
    const { renderer, root } = createComponentRenderer()
    const app = renderer.createApp(Component, { title: '资料', showBack: true, ...(listens ? { onBack: () => emitted++ } : {}) })
    app.component('AButton', defineComponent({ setup: (_props, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
    app.component('AIcon', defineComponent({ setup: () => () => h('i') }))
    app.mount(root)
    try {
      walk(root, node => node.type === 'button')[0].props.onClick()
      assert.equal(emitted, listens ? 1 : 0)
      assert.equal(routed, listens ? 0 : 1)
    } finally { app.unmount() }
  }
})
