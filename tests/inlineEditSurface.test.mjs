import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import {createComponentLoader,createComponentRenderer,walk,flush} from './helpers/componentRuntime.mjs'

const load=createComponentLoader()
const {inlineEditSurfacePlacement:place}=load('components/InlineEditSurface/useInlineEditSurface.ts')
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height})

test('single-line content expands in remaining space and becomes floating beyond its width or height budget',()=>{
  const anchor=rect(100,100,100,26),viewport={width:800,height:600}
  assert.deepEqual(place(anchor,{width:240,height:26},rect(0,0,600,400),viewport),{floating:false,left:100,top:100})
  const constrained=place(anchor,{width:240,height:26},rect(0,0,200,400),viewport)
  assert.equal(constrained.floating,true)
  assert.equal(constrained.left+9,anchor.left,'floating chrome must preserve the content origin')
  assert.equal(place(anchor,{width:240,height:80},rect(0,0,600,400),viewport).floating,true)
})

test('floating content stays within the viewport at the right and bottom edges',()=>{
  const result=place(rect(780,570,24,24),{width:200,height:140},rect(760,0,44,600),{width:820,height:600})
  assert.equal(result.floating,true)
  assert.equal(result.left,586)
  assert.equal(result.top,426)
})

test('changing surface presentation and closing it do not remount or reset the editor',async t=>{
  const floating=vue.ref(false),ready=vue.ref(true),open=vue.ref(true)
  const Teleport=vue.defineComponent({setup:(_,{slots})=>()=>vue.h('portal',slots.default?.())})
  const loadSurface=createComponentLoader({vue:{...vue,Teleport},'./useInlineEditSurface':{useInlineEditSurface:()=>({floating,ready,style:vue.ref({left:'100px',top:'100px'})})}})
  const Surface=loadSurface('components/InlineEditSurface/index.vue').default
  let mounts=0
  const Editor=vue.defineComponent({setup(){mounts++;const draft=vue.ref('unsaved');return()=>vue.h('input',{value:draft.value})}})
  const view=createComponentRenderer(),app=view.renderer.createApp({render:()=>vue.h(Surface,{open:open.value,label:'Tag'},{display:()=>vue.h('button','Read tag'),default:()=>vue.h(Editor)})})
  app.mount(view.root);t.after(()=>app.unmount())
  const input=()=>walk(view.root,n=>n.type==='input')[0],original=input()
  floating.value=true;await flush()
  assert.equal(input(),original)
  open.value=false;await flush();open.value=true;await flush()
  assert.equal(input(),original)
  assert.equal(input().props.value,'unsaved')
  assert.equal(mounts,1)
})

test('placement updates settle without refocusing, closing restores the trigger and unmount cancels queued work',async t=>{
  const frames=new Map(),callbacks=[]
  let frameId=0,focuses=0
  const document={body:{},activeElement:null,defaultView:{innerWidth:800,innerHeight:600,getComputedStyle:()=>({zIndex:'auto',fontFamily:'Arial',fontSize:'12px',fontWeight:'400',lineHeight:'24px',color:'black',direction:'ltr'}),requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId},cancelAnimationFrame:id=>frames.delete(id)}}
  const input={focus(){focuses++;document.activeElement=input}}
  const trigger={focus(){document.activeElement=trigger}}
  const boundary={getBoundingClientRect:()=>bounds,parentElement:null}
  let bounds=rect(0,0,600,400)
  const root=vue.shallowRef({ownerDocument:document,isConnected:true,parentElement:boundary,offsetParent:boundary,getBoundingClientRect:()=>rect(100,100,100,26),querySelector:()=>trigger})
  const layer=vue.shallowRef({ownerDocument:document,contains:el=>el===input,querySelector:()=>input})
  const content=vue.shallowRef({getBoundingClientRect:()=>rect(0,0,240,26)})
  const open=vue.ref(true)
  const loadHook=createComponentLoader({'@vueuse/core':{useResizeObserver:(_target,fn)=>callbacks.push(fn),useEventListener(){}}})
  const {useInlineEditSurface}=loadHook('components/InlineEditSurface/useInlineEditSurface.ts')
  let state
  const view=createComponentRenderer(),app=view.renderer.createApp({setup(){state=useInlineEditSurface({open:()=>open.value,hasDisplay:()=>true,root,layer,content});return()=>vue.h('div',{style:state.style.value},String(state.floating.value)+String(state.ready.value))}})
  app.mount(view.root);t.after(()=>app.unmount())
  async function settle(){for(let i=0;i<10;i++){await flush();if(!frames.size)return;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}assert.fail('layout updates did not settle')}
  await settle()
  assert.equal(state.ready.value,true);assert.equal(state.floating.value,false);assert.equal(focuses,1)
  bounds=rect(0,0,200,400);callbacks.forEach(fn=>fn());await settle()
  assert.equal(state.floating.value,true);assert.equal(focuses,1)
  open.value=false;document.activeElement=document.body;await settle();assert.equal(document.activeElement,trigger,'unmounted form still restores the reader')
  open.value=true;await settle();assert.equal(focuses,2)
  callbacks.forEach(fn=>fn());assert.ok(frames.size)
  app.unmount();assert.equal(frames.size,0)
})
