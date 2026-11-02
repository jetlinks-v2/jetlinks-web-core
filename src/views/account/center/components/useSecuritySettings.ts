import { computed, onMounted, onUnmounted, ref } from 'vue'
import dayjs from 'dayjs'
import {
  getSelfLoginRecords_api, getPasswordChangeSetting_api,
  type SecurityLoginRecord,
} from '@jetlinks-web-core/api/account/center'

/** 读取服务端强制归属当前用户的操作日志，不使用管理端访问日志权限或前端用户过滤。 */
export function useSecuritySettings() {
  const records = ref<SecurityLoginRecord[]>([])
  const passwordTime = ref<number>()
  const loading = ref(false)
  const recordsFailed = ref(false)
  const passwordFailed = ref(false)
  let version = 0
  const passwordChangedAt = computed(() => passwordTime.value
    ? dayjs(passwordTime.value).format('YYYY-MM-DD HH:mm') : '')
  async function load() {
    const current = ++version
    loading.value = true
    const [logs, password] = await Promise.allSettled([
      getSelfLoginRecords_api(), getPasswordChangeSetting_api(),
    ])
    if (current !== version) return
    recordsFailed.value = logs.status === 'rejected'
    passwordFailed.value = password.status === 'rejected'
    if (logs.status === 'fulfilled') {
      const response = logs.value
      recordsFailed.value = response.status !== 200 && !response.success
      if (!recordsFailed.value) records.value = response.result?.data || []
    }
    if (password.status === 'fulfilled') {
      const response = password.value
      passwordFailed.value = response.status !== 200 && !response.success
      if (!passwordFailed.value) {
        const timestamp = Number(response.result?.content)
        passwordTime.value = Number.isFinite(timestamp) && timestamp > 0 && dayjs(timestamp).isValid()
          ? timestamp : undefined
      }
    }
    loading.value = false
  }
  function formatTime(value?: number) {
    return value && Number.isFinite(value) && dayjs(value).isValid()
      ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '—'
  }
  // 此类操作日志明确保存空异常表示成功；历史记录缺失结果时不猜测。
  function resultOf(record: SecurityLoginRecord): 'success' | 'failure' | 'unknown' {
    if (typeof record.exception !== 'string') return 'unknown'
    return record.exception.trim() ? 'failure' : 'success'
  }
  onMounted(load)
  onUnmounted(() => { version++ })
  return { records, passwordChangedAt, loading, recordsFailed, passwordFailed, load, formatTime, resultOf }
}
