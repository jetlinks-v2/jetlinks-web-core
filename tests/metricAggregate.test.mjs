import assert from 'node:assert/strict'
import test from 'node:test'
import {defineComponent,h,ref} from 'vue'
import {resolve} from 'node:path'
import {createMetricLoader,createMetricRenderer,flush,sourceRoot} from './helpers/metricRuntime.mjs'
const load=createMetricLoader({[resolve(sourceRoot,'components/Metric/api.ts')]:{metricApi:{}}})
const {aggregateValue,aggregateCards,aggregateDirectory}=load('components/Metric/collection/aggregatePresentation.ts')
const {useMetricAggregate}=load('components/Metric/collection/useMetricAggregate.ts')

test('scope summaries average unique valid objects and preserve missing results',()=>{
  const point={observed:10,valid:2,sum:30,min:10,max:20}
  assert.equal(aggregateValue(point,'average'),15)
  assert.equal(aggregateValue(point,'min'),10)
  assert.equal(aggregateValue({...point,valid:0},'sum'),undefined)
  assert.equal(aggregateValue({...point,sum:null},'average'),undefined)
})

test('one template card contains compatible outputs but keeps different source parameters separate',()=>{
  const groups=[{id:'health',cardId:'v1-default'},{id:'score',cardId:'v1-default'},{id:'other-threshold',cardId:'v1-custom'},{id:'revision',cardId:'v2-default'}]
  const cards=aggregateCards(groups)
  assert.equal(cards.length,3)
  assert.deepEqual(cards[0].groups.map(item=>item.id),['health','score'])
  assert.deepEqual(cards[1].groups.map(item=>item.id),['other-threshold'])
})

test('authorized template declarations remain visible without fabricating aggregate values or merging parameter groups',()=>{
  const entries=[{id:'a',cardId:'default',templateId:'t',templateName:'Template',version:'1',revision:2,output:{metricId:'score'},operations:['collection','average'],policy:{defaultOperation:'average'}},
    {id:'b',cardId:'default',templateId:'t',templateName:'Template',version:'1',revision:2,output:{metricId:'state'},operations:['collection']},
    {id:'c',cardId:'custom',templateId:'t',templateName:'Template',version:'1',revision:2,output:{metricId:'score'},operations:['collection','average']}]
  const groups=aggregateDirectory([],entries)
  assert.equal(aggregateCards(groups).length,2)
  assert.equal(groups[0].availability,'noRecords');assert.equal(groups[1].availability,'unsupported')
  assert.equal(aggregateValue(groups[0].latest,'average'),undefined)
  const stored={...groups[0],id:'stored',cardId:'t:1:2:default:true',availability:undefined,latest:{valid:2,sum:30}}
  const merged=aggregateDirectory([stored],entries)
  assert.equal(aggregateCards(merged).length,2)
  assert.equal(merged.filter(item=>item.output.metricId==='score').length,2)
  const legacy={...entries[0],revision:undefined}
  assert.equal(aggregateDirectory([{...stored,revision:1,cardId:'t:1:1:default:true'}],[legacy]).length,1,
    'an unspecified published revision resolves to one, matching persisted projections')
})

test('aggregate refresh shares scope requests, keeps old cards mounted and rejects stale scopes',async()=>{
  const pending=[],calls=[]
  const api={aggregate:query=>{calls.push(query);return new Promise(resolve=>pending.push(resolve))}}
  const context=ref({ownerType:'product',ownerId:'p'}),scope=ref({memberType:'device'})
  const {renderer,root}=createMetricRenderer();let state
  const app=renderer.createApp(defineComponent({setup(){state=useMetricAggregate(context,scope,api);return()=>h('div')}}))
  app.mount(root);await new Promise(resolve=>setTimeout(resolve,10));await flush()
  assert.equal(calls.length,1);assert.equal(calls[0].rootId,'p');assert.ok((calls[0].to-calls[0].from)/calls[0].interval<=256)
  pending.shift()({readTime:1,groups:[{id:'one'}]});await flush()
  const refresh=state.refresh();assert.equal(state.result.value.groups[0].id,'one','refresh must not replace cards with a loading placeholder')
  await state.refresh();assert.equal(calls.length,2,'one scope query can be in flight')
  context.value={ownerType:'product',ownerId:'new'};await flush()
  pending.shift()({readTime:2,groups:[{id:'old'}]});await refresh
  await new Promise(resolve=>setTimeout(resolve,10));await flush()
  assert.equal(state.result.value,undefined);assert.equal(calls.at(-1).rootId,'new')
  pending.shift()({readTime:3,groups:[{id:'new'}]});await flush()
  assert.equal(state.result.value.groups[0].id,'new');app.unmount()
})

test('template preference is authorized before querying storage and scope refresh reuses the directory',async()=>{
  const oldStorage=globalThis.localStorage,stored=new Map(),calls=[],catalog=[]
  globalThis.localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)}
  stored.set('metric-aggregate:["u/p","product","p","device"]',JSON.stringify(['t','removed']))
  const api={collection:async query=>{catalog.push(query);return {groups:[{templateId:'t'},{templateId:'other'}]}},aggregate:async query=>{calls.push(query);return {readTime:1,groups:[]}}}
  const context=ref({ownerType:'product',ownerId:'p',preferenceScope:'u/p'})
  const {renderer,root}=createMetricRenderer();let state
  const app=renderer.createApp(defineComponent({setup(){state=useMetricAggregate(context,ref({memberType:'device'}),api);return()=>h('div')}}))
  app.mount(root)
  try {
    await new Promise(resolve=>setTimeout(resolve,10));await flush()
    assert.deepEqual(calls[0].templateIds,['t']);assert.equal(catalog.length,1)
    await state.refresh();assert.equal(catalog.length,1,'regular refresh must not rediscover all members')
    state.selectTemplates(['other']);await flush();assert.deepEqual(calls.at(-1).templateIds,['other'])
    assert.deepEqual(JSON.parse(stored.get('metric-aggregate:["u/p","product","p","device"]')),['other'])
    context.value={...context.value,preferenceScope:'another-user'};await flush();await new Promise(resolve=>setTimeout(resolve,10));await flush()
    assert.equal(calls.at(-1).templateIds,undefined,'identity change must not restore another user selection')
  } finally {app.unmount();globalThis.localStorage=oldStorage}
})
