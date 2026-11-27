import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const filename = new URL('../src/components/IconLibrary/index.vue', import.meta.url).pathname
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
const compiled = transformSync(compileScript(descriptor, { id:'icon-library-save', inlineTemplate:true }).content, { loader:'ts', format:'cjs' }).code
const flush = async () => { await Vue.nextTick(); await new Promise(resolve => setImmediate(resolve)); await Vue.nextTick() }

function mount(props = {}) {
  let picker
  const changes = []
  const Picker = Vue.defineComponent({
    props:['value','loading','error'], emits:['save','close'],
    setup(value, { emit }) {
      picker = { props:value, save:icon => emit('save',icon), close:() => emit('close') }
      return () => Vue.h('aside', {}, value.error)
    },
  })
  const module = { exports:{} }
  new Function('require','module','exports',compiled)(id => id === 'vue' ? Vue
    : id === 'vue-i18n' ? { useI18n:() => ({ t:key => key }) }
      : id === './SelectModal.vue' ? { __esModule:true, default:Picker } : require(id), module, module.exports)
  const renderer = Vue.createRenderer({
    createElement:tag => ({ tag,props:{},children:[] }), createText:text => ({ text,children:[] }),
    createComment:() => ({ children:[] }),
    insert(node,parent,anchor) {
      if(node.parent) { const list=node.parent.children; list.splice(list.indexOf(node),1) }
      node.parent=parent
      const index=parent.children.indexOf(anchor)
      parent.children.splice(index < 0 ? parent.children.length : index,0,node)
    },
    remove(node) { if(node.parent)node.parent.children.splice(node.parent.children.indexOf(node),1) },
    setText(node,text) { node.text=text }, setElementText(node,text) { node.text=text },
    patchProp(node,key,_previous,value) { node.props[key]=value },
    parentNode:node => node.parent, nextSibling:node => node.parent?.children[node.parent.children.indexOf(node)+1],
  })
  const root = { children:[] }
  const app = renderer.createApp(module.exports.default, { type:'BranchesOutlined', ...props, 'onUpdate:type':icon => changes.push(icon) })
  app.component('AIcon', Vue.defineComponent({ props:['type'], setup:value => () => Vue.h('i', { 'data-type':value.type }) }))
  app.mount(root)
  const find = (node, predicate) => predicate(node) ? node : node.children?.map(child => find(child,predicate)).find(Boolean)
  return {
    app,changes,get picker() { return picker },
    trigger:() => find(root,node => node.props?.role === 'button'),
    opened:() => !!find(root,node => node.tag === 'aside'),
    icon:() => find(root,node => node.tag === 'i').props['data-type'],
    async open() { this.trigger().props.onClick({ stopPropagation() {} }); await flush() },
  }
}

test('disabled icon selection cannot open the picker', async t => {
  const view=mount({ disabled:true }); t.after(() => view.app.unmount())
  await view.open()
  assert.equal(view.opened(),false)
  assert.equal(view.trigger().props['aria-disabled'],true)
})

test('the local-value mode still accepts once and closes without a save callback', async t => {
  const view=mount(); t.after(() => view.app.unmount())
  await view.open(); assert.equal(view.picker.props.value,'BranchesOutlined')
  view.picker.save('SendOutlined'); await flush()
  assert.deepEqual(view.changes,['SendOutlined']); assert.equal(view.icon(),'SendOutlined'); assert.equal(view.opened(),false)
})

test('pending icon saves are single-flight and failed values remain available for retry', async t => {
  const pending=[], requests=[]
  const view=mount({ save:icon => { requests.push(icon); return new Promise(resolve => pending.push(resolve)) } })
  t.after(() => view.app.unmount())
  await view.open(); view.picker.save('SendOutlined'); await flush()
  assert.equal(view.picker.props.loading,true)
  view.picker.save('ClockCircleOutlined'); view.picker.close(); await flush()
  assert.deepEqual(requests,['SendOutlined']); assert.equal(view.opened(),true); assert.deepEqual(view.changes,[])
  pending.shift()(false); await flush()
  assert.ok(view.picker.props.error); assert.equal(view.icon(),'BranchesOutlined'); assert.equal(view.opened(),true)
  view.picker.save('SendOutlined'); pending.shift()(true); await flush()
  assert.deepEqual(view.changes,['SendOutlined']); assert.equal(view.icon(),'SendOutlined'); assert.equal(view.opened(),false)
})

test('a rejected persistence promise retains the picker and accepted icon', async t => {
  const view=mount({ save:async () => { throw new Error('offline') } }); t.after(() => view.app.unmount())
  await view.open(); view.picker.save('SendOutlined'); await flush()
  assert.ok(view.picker.props.error); assert.equal(view.opened(),true); assert.equal(view.icon(),'BranchesOutlined')
  assert.deepEqual(view.changes,[])
})
