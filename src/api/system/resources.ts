import { request } from '@jetlinks-web/core'

/** 读取当前后端加载的资源能力，与当前用户的菜单、按钮授权分开判断。 */
export async function hasBackendPermission(permissionId: string): Promise<boolean> {
  const response = await request.get<boolean>(
    `/system/resources/permission/${encodeURIComponent(permissionId)}/exists`,
    undefined,
    { applicationScope: false, hiddenError: true },
  )
  return response.success && response.result === true
}
