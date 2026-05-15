import { defineStore } from 'pinia'

const SHOW_DELAY = 120

export const useRouteLoadingStore = defineStore('route-loading', () => {
  const pending = ref(false)
  const visible = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const start = () => {
    pending.value = true
    clearTimer()
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
  }

  const reset = () => {
    finish()
  }

  return {
    pending,
    visible,
    start,
    finish,
    reset
  }
})
