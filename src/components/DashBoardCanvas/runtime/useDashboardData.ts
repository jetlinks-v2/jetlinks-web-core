import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * 仪表盘数据管理 Hook
 * 包含：数据订阅逻辑、模拟数据定时器逻辑
 * @param props 组件 props
 * @param componentKey 组件在 componentProps 中的 key (如 'gauge1', 'switchList')
 */
export function useDashboardData(props: any, componentKey: string) {
  const dataSourceList = ref<any[]>([])
  const _dataMap = ref<any>({})
  let events: any = []
  const mockTimer = ref<any>(null)

  const getValue = (record: any) => {
    const id = `${record.sourceId}_${record.deviceId}_${record.mappingId}`
    return _dataMap.value[id]
  }

  const setValue = (record: any, value: any) => {
    const id = `${record.sourceId}_${record.deviceId}_${record.mappingId}`
    _dataMap.value[id] = value
  }

  // 订阅实时数据
  const subscribeData = (val: any[]) => {
    // 清理旧的订阅
    events?.forEach((event: any) => event?.())
    events = []

    if (!val || !val.length) return

    val.forEach((item: any) => {
      const id = item.id
      events.push(
        (window as any).$viewDataEventBus?.subscribe(id, (data: any) => {
          const mappingKey = Object.keys(item.mapping)[0]
          _dataMap.value[id] = data[mappingKey]
        })
      )
    })
  }
  const stopMockDataTimer = () => {
    if (mockTimer.value) {
      clearInterval(mockTimer.value)
      mockTimer.value = null
    }
  }

  const updateList = () => {
    let options = props.info.extraProps?.options || []
    const commonConfig = props.info.componentProps?.[componentKey] || {}
    const hasData = options.length > 0

    if (!hasData) {
      options = [
        {
          mappingName: '模拟数据',
          mappingId: 'mock_data',
          value: 50,
          config: {}
        }
      ]
    }

    dataSourceList.value = options.map((opt: any) => {
      const isMock = opt.mappingId === 'mock_data'
      return {
        ...opt,
        name: opt.mappingName,
        key: opt.mappingId,
        isMock,
        // 如果开启了独立配置，则优先使用 opt[componentKey]，然后 opt.config，最后 commonConfig
        config: opt.independence
          ? { ...opt.config, ...commonConfig, ...(opt[componentKey] || {}) }
          : { ...opt.config, ...commonConfig }
      }
    })

    if (hasData) {
      stopMockDataTimer()
    }
  }

  // 监听数据源配置变化
  watch(
    () => props.info.dataSourceProps,
    (val) => {
      subscribeData(val)
    },
    { deep: true, immediate: true }
  )

  // 监听组件整体配置变化
  watch(
    () => props.info,
    () => {
      updateList()
    },
    { deep: true, immediate: true }
  )

  onBeforeUnmount(() => {
    events?.forEach((event: any) => event?.())
    stopMockDataTimer()
  })

  return {
    dataSourceList,
    getValue,
    setValue
  }
}
