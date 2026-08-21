import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import {
  getApplicationScopeFromLocation,
  isProjectApplicationScope,
} from '@jetlinks-web-core/utils/application-scope'
import { isProjectRuntime } from '@jetlinks-web-core/utils/project-runtime'
import { resolveBasicLayoutVariant } from '../runtime/layoutVariant'

/**
 * systemInfo 已由启动流程按当前项目/应用 Scope 拉取，这里只消费配置并补运行态回退。
 */
export const useBasicLayoutVariant = () => {
  const systemStore = useSystemStore()
  const { systemInfo } = storeToRefs(systemStore)
  const applicationScope = getApplicationScopeFromLocation()
  const projectScope = isProjectApplicationScope(applicationScope)
  const runtimeContext = {
    projectScope,
    applicationScope: !!applicationScope && !projectScope,
    projectRuntime: isProjectRuntime(),
  }

  return computed(() => resolveBasicLayoutVariant(
    systemInfo.value.front?.layoutVariant,
    runtimeContext,
  ))
}
