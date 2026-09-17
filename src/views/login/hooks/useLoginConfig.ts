import { ref, onMounted } from 'vue'
import { getIdentityProviders } from '@jetlinks-web-core/api/login'
import type { IdentityProvider } from '@jetlinks-web-core/api/login'
import { message } from 'ant-design-vue'

export function useLoginConfig() {
  const loading = ref(false)
  const providers = ref<IdentityProvider[]>([])

  const fetchProviders = async () => {
    loading.value = true
    try {
      const resp = await getIdentityProviders()
      if (resp.success) {
        providers.value = resp.result
      }
    } catch (error) {
      console.error('Failed to get identity providers:', error)
      // Optional: Display error if critical
      // message.error('获取登录配置失败')
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    fetchProviders()
  })

  return {
    loading,
    providers,
    fetchProviders
  }
}
