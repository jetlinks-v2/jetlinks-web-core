import assert from 'node:assert/strict'
import test from 'node:test'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createComponentLoader, passthrough } from './helpers/componentRuntime.mjs'

const load = createComponentLoader({
  'vue-i18n': { useI18n: () => ({ t: key => key }) },
  'ant-design-vue': Object.fromEntries(['Alert', 'Button', 'Dropdown', 'Empty', 'Menu', 'MenuItem', 'Spin'].map(name => [name, passthrough(name)])),
})
const Tabs = load('components/SlantedTabs/index.vue').default

for (const flush of [false, true]) for (const first of [true, false]) {
  test(`${flush ? 'flush' : 'default'} ${first ? 'first' : 'internal'} tab renders a complete 1px vector border`, async () => {
    const app = createSSRApp({ render: () => h(Tabs, {
      flush, activeKey: first ? 'first' : 'second',
      options: [{ key: 'first', label: 'First' }, { key: 'second', label: 'Second' }],
    }) })
    app.component('AIcon', passthrough('icon'))
    const html = await renderToString(app)
    const outlines = [...html.matchAll(/<svg[^>]*class="slanted-tabs__outline"[\s\S]*?<\/svg>/g)]
    assert.equal(outlines.length, 1)
    const outline = outlines[0][0]
    assert.match(outline, /stroke-width="1"/)
    assert.match(outline, /vector-effect="non-scaling-stroke"/)
    assert.match(outline, /aria-hidden="true"/)
    assert.doesNotMatch(outline, /clip-path|<clipPath/)
    const path = outline.match(/\sd="([^"]+)"/)[1]
    assert.equal(path.includes('H'), !flush, 'only standalone tabs draw their own top edge')
    assert.equal(path.includes('V'), !flush && first, 'only the standalone first tab draws a straight left edge')
    assert.equal((path.match(/M/g) || []).length, flush && !first ? 2 : 1, 'flush internal tabs keep two separate side edges')
  })
}
