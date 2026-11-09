import { request } from '@jetlinks-web/core'

interface CommandSupportResponse<T> {
  success: boolean
  result?: T
}

/** 探测当前用户可见的命令模块能力；元数据可能按权限过滤，不能作为部署开关。 */
export async function hasCommandSupport(serviceId: string): Promise<boolean> {
  const response: CommandSupportResponse<boolean> = await request.get(
    `/command-supports/service/${encodeURIComponent(serviceId)}/exists`,
    undefined,
    { applicationScope: false, hiddenError: true },
  )
  return response.success && response.result === true
}

/**
 * 从服务声明识别已注册的 Provider，不执行命令或探测设备在线状态。
 * 部署能力应读取不受命令权限过滤的服务列表；动态服务（如 agentService）也无需具体设备。
 */
export async function hasCommandService(serviceId: string): Promise<boolean> {
  const response: CommandSupportResponse<{ id: string }[]> = await request.get(
    '/command-supports/services',
    undefined,
    { applicationScope: false, hiddenError: true },
  )
  return response.success && response.result?.some(
    service => service.id === serviceId || service.id.startsWith(`${serviceId}:`),
  ) === true
}
