import { request } from '@jetlinks-web/core'

// 查询当前用户可访问的权限信息（个人令牌使用）
export const exportPermission_api = (data: any) =>
  request.post(`/personal/token/permissions`, data);
