import { request } from '@jetlinks-web/core'

interface CommandSupportResponse<T> {
  success: boolean
  result?: T
  message?: string
}

/** 探测可执行的命令模块能力，serviceId 使用后端注册的完整服务标识，与用户授权分开判断。 */
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
 * 动态服务（如 agentService）要求具体设备才能获取命令元数据，部署能力应读取服务列表。
 * 只有成功取得列表才能判断服务缺失；查询失败交由调用方显示错误或重试。
 */
export async function hasCommandService(serviceId: string): Promise<boolean> {
  const response: CommandSupportResponse<{ id: string }[]> = await request.get(
    '/command-supports/services',
    undefined,
    { applicationScope: false, hiddenError: true },
  )
  if (!response.success || !Array.isArray(response.result)) {
    throw new Error(response.message || 'Command service registry unavailable')
  }
  return response.result.some(
    service => service.id === serviceId || service.id.startsWith(`${serviceId}:`),
  )
}
