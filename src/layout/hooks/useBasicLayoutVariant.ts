import { computed } from 'vue'
import {
  getApplicationRuntimeEntry,
  getProjectRuntimeConfig,
} from '@jetlinks-web-core/utils/project-runtime'
import { isRuntimeRootPath } from '@jetlinks-web-core/utils/project-path'
import type { BasicLayoutVariant } from '../runtime/layoutVariant'

/**
 * 统一壳层和控制器的端类型；应用入口优先，固定项目部署无需 URL 项目标识。
 * 运行态按布局创建时的入口确定，存储变化不会触发响应式更新。
 */
export const useBasicLayoutVariant = () => computed<BasicLayoutVariant>(() => {
  const { type } = getApplicationRuntimeEntry()
  // 固定项目构建的根后台复用项目壳层，不改变其业务入口身份。
  if (type === 'tenant' && isRuntimeRootPath() && getProjectRuntimeConfig().fixedProject) return 'project'
  return type
})
