import type { AgentPagePointDeclaration } from '@jetlinks-web-core/types/agent-page-point'
import { modules } from '@jetlinks-web-core/utils/modules'
import { agentData } from '@jetlinks-web-core/views/init-home/data/aiData'

/**
 * 合并内置和已启用模块的页面功能点，供初始化与部署窗口共用。
 * 不缓存模块声明，让同步时使用当前语言；保存接口未传 owner，故按 clientId 去重。
 */
export const getAgentPagePointDeclarations = (): AgentPagePointDeclaration[] => {
  const declarations = new Map(agentData.map(item => [item.clientId, item]))

  // modules() 已按 priority 升序排列并排除 filter=true，后声明覆盖前声明。
  for (const item of Object.values(modules())) {
    for (const declaration of item.default.getAgentPagePoints?.() ?? []) {
      if (declarations.has(declaration.clientId)) {
        console.warn(`[AI page point] Module "${item.name}" overrides clientId "${declaration.clientId}"`)
      }
      declarations.set(declaration.clientId, declaration)
    }
  }
  return [...declarations.values()]
}
