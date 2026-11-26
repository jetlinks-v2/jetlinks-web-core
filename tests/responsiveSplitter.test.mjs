import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, nextTick, onMounted, reactive, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer, walk } from './helpers/componentRuntime.mjs'

const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
function mount(collapsed = false, accept = true) {
  const width = ref(700), height = ref(420), coarse = ref(false), props = reactive({ collapsed }), api = ref(), requests = []
  const Splitter = defineComponent({ props:['collapsed'], setup:(_props,{slots}) => () => h('main', [slots.start?.(),slots.end?.()]) })
  const Handle = defineComponent({ setup:() => () => h('div',{role:'separator'}) })
  const Drawer = defineComponent({ props:['open'], inheritAttrs:false, setup:(props,{slots}) => () => h('aside',{'data-open':props.open},slots.default?.()) })
  const Component = createDashboardLoader({
    'vue-i18n':{useI18n:()=>({t:key=>key})},
    '@vueuse/core':{useElementSize:()=>({width,height}),useMediaQuery:query=>query === '(pointer: coarse)' ? coarse : ref(false)},
    'ant-design-vue':{Drawer,Button:defineComponent({setup:(_props,{slots})=>()=>h('button',slots.default?.())})},
    '@ant-design/icons-vue':{CloseOutlined:defineComponent({setup:()=>()=>h('i')})},
    './index.vue':{default:Splitter,__esModule:true},'../PanelResizeHandle/index.vue':{default:Handle,__esModule:true},
  })('components/Splitter/ResponsiveSplitter.vue').default
  const state = createComponentRenderer()
  let mounts = 0
  const Content = defineComponent({setup(){onMounted(()=>mounts++);return()=>h('input',{'aria-label':'draft',value:'retained'})}})
  const app = state.renderer.createApp({setup:()=>()=>h(Component,{...props,ref:api,min:160,endMin:240,'onUpdate:collapsed':value=>{requests.push(value);if(accept)props.collapsed=value}}, {start:()=>h(Content),end:()=>h('p','detail')})})
  app.mount(state.root)
  return {...state,app,width,height,coarse,props,api,requests,mounts:()=>mounts,field:()=>walk(state.root,node=>node.props['aria-label']==='draft')[0],drawer:()=>walk(state.root,node=>node.type==='aside')[0]}
}

test('compact budget includes custom gutter and the pointer recovery target on both axes', async t => {
  const view = mount(); t.after(() => view.app.unmount()); await flush()
  view.props.gutter = 40; view.width.value = 430; await flush()
  assert.equal(view.api.value.compact, true)
  view.width.value = 440; await flush()
  assert.equal(view.api.value.compact, false)
  view.props.orientation = 'vertical'; view.height.value = 430; await flush()
  assert.equal(view.api.value.compact, true)
  view.props.resizable = false; await flush()
  assert.equal(view.api.value.compact, false)
  view.height.value = 418; view.coarse.value = true; await flush()
  assert.equal(view.api.value.compact, true)
  view.coarse.value = false; await flush()
  assert.equal(view.api.value.compact, false)
  view.props.gutter = -10; view.props.resizable = true; await flush()
  assert.equal(view.api.value.compact, false)
})

test('responsive layout moves one content instance and temporary opening preserves the wide preference', async t => {
  const view = mount(); t.after(()=>view.app.unmount()); await flush()
  const field = view.field()
  assert.ok(field)
  view.width.value = 300; await flush()
  assert.equal(view.api.value.compact,true)
  assert.equal(view.field(),field)
  view.api.value.toggle(); await flush()
  assert.equal(view.drawer().props['data-open'],true)
  assert.deepEqual(view.requests,[])
  view.width.value = 700; await flush()
  assert.equal(view.drawer().props['data-open'],false)
  assert.equal(view.api.value.collapsed,false)
  assert.equal(view.field(),field)
  assert.equal(view.mounts(),1)
})

test('controlled rejection and manual collapse survive temporary drawer use', async t => {
  for (const accept of [false,true]) {
    const view=mount(false,accept);t.after(()=>view.app.unmount());await flush()
    view.api.value.toggle();await flush()
    assert.equal(view.api.value.collapsed,accept)
    view.width.value=300;await flush()
    view.api.value.toggle();await flush()
    assert.equal(view.drawer().props['data-open'],true)
    view.api.value.close();await flush()
    view.width.value=700;await flush()
    assert.equal(view.api.value.collapsed,accept)
    assert.deepEqual(view.requests,[true])
  }
})

test('vertical adaptation uses available height and retains the same content when direction changes', async t => {
  const view = mount(); t.after(() => view.app.unmount()); await flush()
  const field = view.field()
  view.width.value = 300; await flush()
  assert.equal(view.api.value.compact, true)
  view.props.orientation = 'vertical'; await flush()
  assert.equal(view.api.value.compact, false)
  view.height.value = 300; await flush()
  assert.equal(view.api.value.compact, true)
  view.api.value.toggle(); await flush()
  assert.equal(view.drawer().props['data-open'], true)
  view.height.value = 700; await flush()
  assert.equal(view.drawer().props['data-open'], false)
  assert.equal(view.api.value.collapsed, false)
  assert.equal(view.field(), field)
  assert.equal(view.mounts(), 1)
  assert.deepEqual(view.requests, [])
})
