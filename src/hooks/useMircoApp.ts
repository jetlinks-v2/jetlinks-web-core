import { isSubApp } from '@/utils/consts'

export const useMircoAppData = (key?: string | 'platformName') => {
  let data = ref<Record<string, any>>({
    platformName: inject('platformName', 'iot'),
  })

  if (isSubApp) {
    data.value = (window as any).microApp.getGlobalData() || {}
  }

  return {
    data: key ? data.value[key] : data
  }
}
