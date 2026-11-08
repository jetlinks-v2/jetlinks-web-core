import test from 'node:test'
import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { createMetricLoader, createMetricRenderer, walk } from './helpers/metricRuntime.mjs'
const load=createMetricLoader({'vue-i18n':{useI18n:()=>({t:key=>key})}})
const {useExpressionFunctionMenu}=load('components/Expression/useExpressionFunctionMenu.ts')
test('函数菜单按稳定目录分类，按名称ID或描述搜索且保留禁用状态',()=>{
  const props=reactive({conditionDisabled:false,hideConditions:false,functions:[{id:'math.floor',name:'向下取整',description:'不大于输入',disabled:true},{id:'stats.avg',name:'数据均值',description:'数值集合的平均值'},{id:'custom.demo',name:'其他函数',description:'业务处理'}]})
  const {query,groups}=useExpressionFunctionMenu(props)
  assert.deepEqual(groups.value.map(group=>group.id),['math','stats','other'])
  query.value='平均';assert.deepEqual(groups.value.map(group=>group.id),['stats'])
  query.value=' FLOOR ';assert.equal(groups.value[0].items[0].disabled,true)
  query.value='无匹配';assert.deepEqual(groups.value,[])
  query.value='';props.hideConditions=true;assert.equal(groups.value.some(group=>group.id==='condition'),false)
  props.hideConditions=false;props.conditionDisabled=true;assert.equal(groups.value.some(group=>group.id==='condition'),false)
})

test('函数搜索的Esc只关闭菜单，阻止原生dialog取消并隔离画布快捷键',()=>{
  const Menu=load('components/Expression/ExpressionFunctionMenu.vue').default
  const {renderer,root}=createMetricRenderer(),closed=[]
  const app=renderer.createApp(Menu,{functions:[],onClose:()=>closed.push(true)})
  app.config.warnHandler=()=>{};app.mount(root)
  try {
    const input=walk(root,node=>node.type==='a-input')[0]
    const fire=key=>{
      const event={key,prevented:false,stopped:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}}
      for(const handler of [].concat(input.props.onKeydown))handler(event)
      return event
    }
    const escape=fire('Escape');assert.equal(escape.prevented,true);assert.equal(escape.stopped,true);assert.equal(closed.length,1)
    const arrow=fire('ArrowLeft');assert.equal(arrow.prevented,false);assert.equal(arrow.stopped,true);assert.equal(closed.length,1)
  } finally {app.unmount()}
})
