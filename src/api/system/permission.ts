import { request } from '@jetlinks-web/core'

// 导出权限数据
export const exportPermission_api = (data: any) => request.post(`/permission/_query/no-paging`, data);
