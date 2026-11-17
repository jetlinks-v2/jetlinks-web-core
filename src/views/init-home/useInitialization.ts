import { ref } from 'vue'

export interface InitializationStep { key: string; run: () => Promise<unknown> }

/** Stop on the first failed stage; the initialization marker and redirect are always last. */
export async function runInitialization(steps: InitializationStep[], failed: (key: string) => void) {
  for (const step of steps) {
    try {
      if (!await step.run()) { failed(step.key); return false }
    } catch { failed(step.key); return false }
  }
  return true
}

export function useInitialization(steps: InitializationStep[], completed: () => void) {
  const loading = ref(false)
  const failedStep = ref('')
  async function submit() {
    if (loading.value) return
    loading.value = true
    failedStep.value = ''
    try {
      const ok = await runInitialization(steps, key => { failedStep.value = key })
      if (ok) completed()
    } finally { loading.value = false }
  }
  return { loading, failedStep, submit }
}
