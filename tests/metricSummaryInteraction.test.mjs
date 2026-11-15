import assert from 'node:assert/strict'
import test from 'node:test'
import {defineComponent,h,ref} from 'vue'
import {resolve} from 'node:path'
import {createMetricLoader,createMetricRenderer,flush,sourceRoot,textContent,walk} from './helpers/metricRuntime.mjs'

const api={}
const Panel=defineComponent({setup(_,{expose}){expose({canLeave:async()=>true});return()=>h('metric-panel')}})
const Collection=defineComponent({props:['selection'],emits:['clearSelection'],setup(props,{emit}){return()=>h('current-results',{selection:props.selection,onClick:()=>emit('clearSelection')})}})
const Card=defineComponent({props:['groups'],emits:['members'],setup(props,{emit}){return()=>h('summary-card',{onClick:()=>emit('members')},props.groups[0].templateName)}})
const load=createMetricLoader({
  'ant-design-vue':{Empty:{PRESENTED_IMAGE_SIMPLE:'simple'}},
  'vue-i18n':{useI18n:()=>({t:(key,args)=>args ? `${key}:${JSON.stringify(args)}` : key,locale:ref('zh')})},
  [resolve(sourceRoot,'components/Metric/api.ts')]:{metricApi:api},
  [resolve(sourceRoot,'components/Metric/MetricPanel.vue')]:{__esModule:true,default:Panel},
  [resolve(sourceRoot,'components/Metric/bindings/MetricObjectBindings.vue')]:{__esModule:true,default:defineComponent({setup:()=>()=>h('bindings')})},
  [resolve(sourceRoot,'components/Metric/bindings/useMetricBindings.ts')]:{useMetricBindings:()=>({busy:ref(false),includeDescendants:ref(false),page:{state:ref({status:'ready'}),data:ref({items:[]})}})},
  [resolve(sourceRoot,'components/Metric/collection/MetricCollection.vue')]:{__esModule:true,default:Collection},
  [resolve(sourceRoot,'components/Metric/collection/MetricAggregateCard.vue')]:{__esModule:true,default:Card},
})
const ScopePanel=load('components/Metric/collection/MetricScopePanel.vue').default
const Overview=load('components/Metric/collection/MetricAggregateOverview.vue').default
const point={time:1,observed:2,valid:1,sum:10,distribution:{}}
const stored={id:'value',cardId:'t:1:1:default:true',templateId:'t',templateName:'Temperature',version:'1',revision:1,output:{metricId:'value'},operations:['average'],defaultOperation:'average',latest:point,points:[]}
const entry={...stored,id:'catalog',cardId:'default',operations:['collection','average']}
const scope={memberType:'device',label:'Devices',icon:'DesktopOutlined',tree:true}
const settle=async()=>{await new Promise(resolve=>setTimeout(resolve,15));await flush()}

function mount(component,props){
  const {renderer,root}=createMetricRenderer(),app=renderer.createApp({setup:()=>()=>h(component,props())})
  for(const name of ['AIcon','a-tabs','a-tab-pane','a-button','a-dropdown','a-menu','a-menu-item','a-tooltip','a-checkbox','a-select','a-select-option','a-empty','a-skeleton','a-alert','a-popover','a-input','a-range-picker']){
    app.component(name,defineComponent({inheritAttrs:false,setup(_,{attrs,slots}){return()=>h(name,attrs,[slots.default?.(),...(name==='a-dropdown' ? slots.overlay?.() || [] : [])])}}))
  }
  app.mount(root)
  return {app,root}
}

test('summary uses one task, keeps filters on drilldown return and hides adding actions outside metrics',async()=>{
  const calls=[]
  api.collection=async query=>({visibleMembers:2,groups:[entry],data:[],readTime:1,total:2})
  api.aggregate=async query=>{calls.push(query);return {readTime:1,from:query.from,to:query.to,interval:query.interval,groups:[stored]}}
  const context=ref({ownerType:'deviceGroup',ownerId:'g',editable:true,readScopes:[scope,{memberType:'deviceGroup',label:'Child groups',icon:'FolderOutlined',tree:true}]})
  const {app,root}=mount(ScopePanel,()=>({context:context.value}))
  try {
    assert.match(textContent(root),/addMetric/)
    walk(root,node=>node.type==='a-tabs')[0].props.onChange('overview');await settle()
    assert.doesNotMatch(textContent(root),/addMetric/)
    assert.equal(walk(root,node=>node.type==='a-radio-group').length,0)
    walk(root,node=>node.type==='a-menu')[0].props.onClick({key:'false'});await settle()
    walk(root,node=>node.type==='button'&&node.props.title==='day')[0].props.onClick();await settle()
    const before=calls.at(-1)
    assert.equal(before.depth,'self');assert.equal(before.to-before.from,86400000)
    walk(root,node=>node.type==='summary-card')[0].props.onClick();await flush()
    const current=walk(root,node=>node.type==='current-results')[0]
    assert.deepEqual(current.props.selection,{templateId:'t',descendants:false})
    assert.equal(walk(root,node=>node.type==='a-tabs')[0].props['active-key'],'overview')
    current.props.onClick();await settle()
    assert.equal(calls.at(-1).to-calls.at(-1).from,86400000);assert.equal(calls.at(-1).depth,'self')
    walk(root,node=>node.type==='a-select')[0].props.onChange('deviceGroup');await settle()
    assert.equal(calls.at(-1).depth,'children');assert.equal(calls.at(-1).to-calls.at(-1).from,86400000)
    context.value={...context.value,readScopes:[]};await flush()
    assert.equal(walk(root,node=>node.type==='current-results').length,0)
    assert.match(textContent(root),/addMetric/)
  } finally {app.unmount()}
})

test('empty summaries distinguish authorized facts, history availability and a neutral unknown scope',async()=>{
  const scenarios=[
    {catalog:{visibleMembers:0,groups:[]},groups:[],reason:'aggregateNoMembers',current:false},
    {catalog:{visibleMembers:3,groups:[]},groups:[],reason:'aggregateNoMetrics',current:true},
    {catalog:{visibleMembers:3,groups:[entry]},groups:[],reason:'aggregateEmpty',current:true},
    {catalog:{visibleMembers:3,groups:[{...entry,output:{metricId:'value',latestOnly:true}}]},groups:[],reason:'aggregateUnsupported',current:true},
    {catalog:undefined,groups:[],reason:'aggregateEmpty',current:false},
    {catalog:{visibleMembers:3,groups:[entry]},groups:[stored],reason:undefined,current:true},
    {catalog:{visibleMembers:0,groups:[]},groups:[stored],reason:undefined,current:true},
  ]
  for(const scenario of scenarios){
    api.collection=scenario.catalog ? async()=>scenario.catalog : undefined
    api.aggregate=async query=>({readTime:1,from:query.from,to:query.to,interval:query.interval,groups:scenario.groups})
    const members=[],{app,root}=mount(Overview,()=>({context:{ownerType:'group',ownerId:'g',readScopes:[scope]},scope,onMembers:selection=>members.push(selection)}))
    try {
      await settle()
      const empty=walk(root,node=>node.type==='a-empty'&&node.props.class==='aggregate-overview__empty')[0]
      assert.equal(empty?.props.description,scenario.reason)
      if(scenario.reason){
        const current=walk(root,node=>node.type==='a-button'&&textContent(node)==='viewCurrent')[0]
        assert.equal(!!current,scenario.current)
        if(current){current.props.onClick();assert.deepEqual(members,[{templateId:undefined,descendants:true}])}
      }
    } finally {app.unmount()}
  }
})
