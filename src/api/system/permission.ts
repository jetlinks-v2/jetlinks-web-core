import { request } from '@jetlinks-web/core'
import { paramsEncodeQuery } from '@jetlinks-web-core/utils/encodeQuery'

// 查询当前用户可访问的权限信息（个人令牌使用）
export const exportPermission_api = (data: any) =>
  request.post(`/personal/token/permissions`, data);

// GET 条件使用 terms[0].column 等属性路径，避免默认方括号编码导致 Spring 对象绑定失败。
export const queryPermission_api = (data: any) => {
  const { terms, sorts, ...params } = data
  return request.get(`/permission/_query/for-grant`, {
    ...params,
    ...paramsEncodeQuery({ terms, sorts, current: params.current }),
  });
}
