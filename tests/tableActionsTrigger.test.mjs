import assert from 'node:assert/strict'
import test from 'node:test'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createComponentLoader } from './helpers/componentRuntime.mjs'

const shell = defineComponent({ setup: (_, { slots }) => () => h('div', [slots.default?.(), slots.content?.(), slots.icon?.()]) })
const load = createComponentLoader({
  './style.css': {},
  'vue-i18n': { useI18n: () => ({ t: () => 'More actions' }) },
  'ant-design-vue': { Button: shell, Popover: shell, theme: { useToken: () => ({ token: { value: { colorBgTextHover:'#eee', borderRadiusSM:4, paddingXXS:4 } } }) } },
  '@ant-design/icons-vue': { EllipsisOutlined: { render: () => h('i', { 'data-default-trigger': true }) } },
})

test('group separators are opt-in and leave the existing default items untouched', async () => {
  const html=await renderToString(createSSRApp({render:()=>h(Actions,{},()=>[
    h(Item,{},()=>h('button','Open web interface')),
    h(Item,{separated:true,closeOnClick:false},()=>h('button','Disable device')),
    h(Item,{separated:true},()=>h('button','Delete device')),
  ])}))
  assert.equal((html.match(/table-actions__item--separated/g)||[]).length,2)
  assert.ok(html.indexOf('Open web interface')<html.indexOf('Disable device'))
  assert.ok(html.indexOf('Disable device')<html.indexOf('Delete device'))
})
const Actions = load('components/TableActions/TableActions.ts').default
const Item = load('components/TableActions/TableActionsItem.ts').default

test('custom trigger replaces only the default trigger and preserves action content and initial expanded state', async () => {
  for (const custom of [false, true]) {
    const app = createSSRApp({ render: () => h(Actions, {}, {
      default: () => h(Item, {}, () => h('button', 'Edit device')),
      ...(custom ? { trigger: ({ open }) => h('button', { 'aria-expanded': open }, 'Device actions') } : {}),
    }) })
    const html = await renderToString(app)
    assert.match(html, /Edit device/)
    assert.equal(html.includes('data-default-trigger'), !custom)
    assert.equal(html.includes('Device actions'), custom)
    assert.match(html, /aria-expanded="false"/)
  }
})
