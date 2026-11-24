import { computed, nextTick, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { ECharts } from 'echarts/core'
import { BrushComponent } from 'echarts/components'

type TimeRange = [number,number]
type ZoomEvent = { start?:number; end?:number; startValue?:number; endValue?:number; batch?:ZoomEvent[] }
export interface TimeZoomControls {
  overview:Ref<boolean>; brushing:Ref<boolean>; brush:()=>void; reset:()=>void
}
/** Native ECharts zoom events may contain either percentages or timestamps (including batched toolbox actions). */
export function timeZoomRange(event:ZoomEvent, bounds:TimeRange):TimeRange | undefined {
  const payload = event.batch?.[0] || event
  const from = payload.startValue ?? (payload.start === undefined ? bounds[0] : bounds[0]+payload.start/100*(bounds[1]-bounds[0]))
  const to = payload.endValue ?? (payload.end === undefined ? bounds[1] : bounds[0]+payload.end/100*(bounds[1]-bounds[0]))
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return
  const range:TimeRange = [Math.max(bounds[0],from),Math.min(bounds[1],to)]
  return range[1] > range[0] && (range[0] > bounds[0] || range[1] < bounds[1]) ? range : undefined
}

/** View-only zoom keeps absolute time through rolling refresh; consumers reset scope when the user changes the query. */
export function useTimeZoom(bounds:Ref<TimeRange | undefined>, view:Ref<TimeRange | undefined>, update:(range?:TimeRange)=>void, t:(key:string)=>string, externalTools=false) {
  let instance:ECharts | undefined, nativeView:string | undefined, revision=0, frame:number | undefined
  const overview=ref(!externalTools),brushing=ref(false)
  function cancelBrush() {
    if (!brushing.value) return
    brushing.value=false
    instance?.dispatchAction({type:'takeGlobalCursor',key:'brush',brushOption:{brushType:false}})
    instance?.dispatchAction({type:'brush',areas:[]})
  }
  const controls:TimeZoomControls = {
    overview,brushing,
    brush:() => {
      brushing.value=!brushing.value
      instance?.dispatchAction({type:'takeGlobalCursor',key:'brush',brushOption:{brushType:brushing.value ? 'lineX' : false}})
    },
    reset:() => { cancelBrush(); instance?.dispatchAction({type:'restore'}); update(undefined) },
  }
  // Retain an inspected time window even after it leaves the returned data; never jump to newer samples.
  const from = computed(() => bounds.value && Math.min(bounds.value[0],view.value?.[0] ?? bounds.value[0]))
  const to = computed(() => bounds.value && Math.max(bounds.value[1],view.value?.[1] ?? bounds.value[1]))
  const extent = computed<TimeRange | undefined>(() => from.value === undefined || to.value === undefined ? undefined : [from.value,to.value])
  const signature = (range?:TimeRange) => JSON.stringify(range || bounds.value)
  const cancel = () => { revision++; if (frame !== undefined) cancelAnimationFrame(frame); frame=undefined }
  /** Apply external focus/reset after the wrapper's pending option frame; native gestures never echo through setOption. */
  async function apply(range?:TimeRange) {
    cancel()
    const current=revision
    await nextTick()
    if (current !== revision || !instance || instance.isDisposed()) return
    const dispatch = () => {
      frame=undefined
      if (current === revision && instance && !instance.isDisposed()) instance.dispatchAction({type:'dataZoom',dataZoomId:'time-window',...(range ? {startValue:range[0],endValue:range[1]} : {start:0,end:100})},{silent:true})
    }
    if (typeof requestAnimationFrame === 'undefined') dispatch()
    else frame=requestAnimationFrame(dispatch)
  }
  const option = computed(() => ({
    ...(externalTools ? {brush:{toolbox:[],xAxisIndex:0,brushMode:'single',transformable:false,removeOnClick:true}} : {}),
    toolbox:{ show:!externalTools,right:4,top:0,itemSize:13,feature:{ dataZoom:{ yAxisIndex:'none',title:{ zoom:t('historyBrush'),back:t('historyZoomBack') } },restore:{ title:t('historyResetFocus') } } },
    dataZoom:[
      { id:'time-window',type:'inside' as const,xAxisIndex:0,filterMode:'none' as const,throttle:16,zoomOnMouseWheel:'ctrl' as const,moveOnMouseWheel:false,moveOnMouseMove:true,preventDefaultMouseMove:true },
      { id:'time-slider',show:overview.value,type:'slider' as const,xAxisIndex:0,filterMode:'none' as const,throttle:16,realtime:true,bottom:4,height:20,showDetail:false,showDataShadow:false,brushSelect:false },
    ],
  }))
  const events = {
    brushEnd:(event:unknown) => {
      if(!externalTools || !brushing.value || !event || typeof event!=='object')return
      const area=(event as {areas?:Array<{coordRange?:number[]}>}).areas?.[0]?.coordRange
      if(area?.length===2 && extent.value) {
        const range=timeZoomRange({startValue:area[0],endValue:area[1]},extent.value)
        update(range);void apply(range)
      }
      cancelBrush()
    },
    datazoom:(event:unknown) => {
      if (!bounds.value || !event || typeof event !== 'object') return
      const range=timeZoomRange(event as ZoomEvent,extent.value || bounds.value)
      nativeView=signature(range);update(range)
      cancelBrush()
    },
    restore:() => { nativeView=signature();update(undefined) },
  }
  watch([() => view.value?.[0],() => view.value?.[1]],() => {
    const key=signature(view.value)
    if (key === nativeView) return
    nativeView=key
    void apply(key === signature() ? undefined : view.value)
  },{flush:'post'})
  watch([() => bounds.value?.[0],() => bounds.value?.[1]],() => {
    nativeView=signature(view.value)
    void apply(nativeView === signature() ? undefined : view.value)
  },{flush:'post'})
  function ready(value:ECharts) { instance=value;void apply(view.value) }
  function dispose(value:ECharts) { if (instance === value) { cancel();instance=undefined } }
  onScopeDispose(() => { cancel();instance=undefined })
  return { option,events,extent,ready,dispose,controls,cancelBrush,library:[BrushComponent] }
}
