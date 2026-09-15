import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/** 浏览器夹具的受控状态与事件计数，完全独立于后端。 */
export function useHarness() {
  const mode = ref('mixed')
  const showCopy = ref(true)
  const reverse = ref(false)
  const extra = ref(false)
  const enabled = ref(true)
  const clicks = ref(0)
  const rowClicks = ref(0)
  const confirmations = ref(0)
  const { locale } = useI18n()
  const actions = computed(() => reverse.value ? ['overwrite', 'copy'] : ['copy', 'overwrite'])
  const common = (normal: boolean) => mode.value === 'inline' || (mode.value === 'mixed' && normal)
  const click = () => { clicks.value++ }
  const rowClick = () => { rowClicks.value++ }
  const confirm = () => { confirmations.value++ }
  const switchLocale = () => { locale.value = locale.value === 'zh' ? 'en' : 'zh' }
  return { mode, showCopy, reverse, extra, enabled, clicks, rowClicks, confirmations, actions, common, click, rowClick, confirm, switchLocale }
}
