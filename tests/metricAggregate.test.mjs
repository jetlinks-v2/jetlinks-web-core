import assert from 'node:assert/strict'
import test from 'node:test'
import {defineComponent,h,ref} from 'vue'
import {resolve} from 'node:path'
import {createMetricLoader,createMetricRenderer,flush,sourceRoot} from './helpers/metricRuntime.mjs'
const load=createMetricLoader({[resolve(sourceRoot,'components/Metric/api.ts')]:{metricApi:{}}})
const {aggregateValue,aggregateCards}=load('components/Metric/collection/aggregatePresentation.ts')
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
