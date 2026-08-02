import { defineStore } from 'pinia'
import type { Component } from 'vue'
import type { RouteMeta } from 'vue-router'

const SHOW_DELAY = 120

export const useRouteLoadingStore = defineStore('route-loading', () => {
  const pending = ref(false)
  const visible = ref(false)
  const loadingComponent = shallowRef<Component>()
  const overlay = ref(false)
  const manualFinish = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const start = (meta?: RouteMeta) => {
    pending.value = true
    visible.value = false
    loadingComponent.value = meta?.routeLoadingComponent
    overlay.value = Boolean(loadingComponent.value && meta?.routeLoadingOverlay)
    manualFinish.value = Boolean(overlay.value && meta?.routeLoadingManualFinish)
    clearTimer()

    // 导航确认前 currentRoute 尚未切换，必须从目标 meta 提前取得路由专属 loading。
    if (loadingComponent.value) {
      visible.value = true
      return
    }

    timer = setTimeout(() => {
      if (pending.value) {
        visible.value = true
      }
    }, SHOW_DELAY)
  }

  const finish = () => {
    pending.value = false
    clearTimer()
    visible.value = false
    loadingComponent.value = undefined
    overlay.value = false
    manualFinish.value = false
  }

  const finishNavigation = () => {
    pending.value = false
    clearTimer()
    if (manualFinish.value && visible.value && loadingComponent.value) return
    finish()
  }

  const reset = () => {
    finish()
  }

  return {
    pending,
    visible,
    loadingComponent,
    overlay,
    manualFinish,
    start,
    finish,
    finishNavigation,
    reset
  }
})
