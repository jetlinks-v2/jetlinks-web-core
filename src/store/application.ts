import { defineStore } from 'pinia'
import { ref } from 'vue'
import { uiList } from "@jetlinks-web-core/api/application";
import { isSubApp } from '@jetlinks-web-core/utils/consts'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { createApplicationCodeUrl } from '@jetlinks-web-core/utils/application-scope'

type ApplicationItemType = {
  id: string
  path: string
  name: string
  version?: string
  description?: string
  provider?: string
  page?: {
    baseUrl?: string
    routeType?: 'hash' | 'history'
    parameters?: Array<{ key?: string; value?: string }>
    [key: string]: unknown
  }
  [key: string]: unknown
}

const normalizeApplicationPath = (item: ApplicationItemType) => {
  const configuredPath = typeof item.path === 'string' ? item.path.trim() : ''
  return configuredPath || createApplicationCodeUrl(item.id)
}

export const useApplication = defineStore('application', () => {
  const appList = ref<Array<ApplicationItemType>>([])

  let loaded = false
  let loadPromise: Promise<void> | undefined
  let generation = 0

  /**
   * 合并当前上下文的应用发现与模块加载；失败向调用方传播，下一次调用可重试。
   */
  const queryApplication = (): Promise<void> => {
    if (loaded) return Promise.resolve()
    if (loadPromise) return loadPromise

    const currentGeneration = generation
    const loading = (async () => {
      try {
        const resp = await uiList()
        if (currentGeneration !== generation) return
        if (!resp.success || !Array.isArray(resp.result)) {
          throw new Error(resp.message || '查询应用列表失败')
        }
        let result: ApplicationItemType[] = resp.result
        if (import.meta.env.VITE_MODULE_NAME && !isSubApp) { // 子模块编译之后独立运行时，排除自身
          result = result.filter(item => (item.name + '-ui') !== import.meta.env.VITE_MODULE_NAME)
        }

        result = result.map((item: ApplicationItemType) => ({
          ...item,
          path: normalizeApplicationPath(item),
        }))
        // 应用发现成功不依赖远程资源加载成功，部分失败时仍保留完整目录。
        appList.value = result
        const failures: unknown[] = []

        // remote 共用注册入口，保持顺序并隔离单模块失败，避免阻断后续模块。
        for (const item of result) {
          if (currentGeneration !== generation) return
          const name = item.id + '-ui'
          if (!moduleRegistry.hasModule(name)) { // 没有本地模块注册，获取微前端模块进行注册
            if (!item.path) continue
            const path = [item.path, item.path.endsWith('/') ? '' : '/', 'assets/remoteEntry.js' ].join('')
            try {
              await moduleRegistry.loadRemoteModule(name, path, () => currentGeneration === generation)
            } catch (error) {
              failures.push(error)
            }
          }
        }

        if (currentGeneration !== generation) return
        // 尝试完整列表后传播首个原始错误；失败批次不缓存成功，重试跳过已注册模块。
        if (failures.length) throw failures[0]
        loaded = true
      } catch (error) {
        // reset 前的失败不属于当前上下文，也不能清除新一轮的加载状态。
        if (currentGeneration !== generation) return
        console.error('查询应用列表失败:', error)
        throw error
      }
    })().finally(() => {
      if (loadPromise === loading) loadPromise = undefined
    })
    loadPromise = loading
    return loading
  }

  /**
   * 根据ID查找应用
   */
  const findAppById = (appId: string) => appList.value.find((item: any) => item.id === appId)

  const init = () => {
    generation += 1
    loaded = false
    loadPromise = undefined
    appList.value = []
  }

  return {
    appList,
    queryApplication,
    findAppById,
    init,
  }
})
