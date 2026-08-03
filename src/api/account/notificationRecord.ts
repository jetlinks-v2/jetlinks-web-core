import { request } from '@jetlinks-web/core'

// 获取记录列表
export const getList_api = (data: any): any => request.post(`/notifications/_query`, data)
// 工单消息详情使用当前用户流程权限查询，避免通知记录缺少历史详情时展示空内容。
export const getWorkOrderDetail_api = (id: string): any => request.post(`/park/event-work-order/work-orders/${id}/_my-flow-detail`)
// 修改记录状态
export const changeStatus_api = (type: '_read' | '_unread', data: string[]): any => request.post(`/notifications/${type}`, data)

export const changeAllStatus = (type: '_read' | '_unread', data: string[]): any => request.post(`/notifications/${type}/provider`, data)

//查看工作流通知详情
export const getWorkflowNotice = (data:any) => request.post('/process/runtime/processes/_query/no-paging',data)

// 查询告警记录详情
export const getDetail = (id: string): any => request.get(`/alarm/record/${id}`)

/**
 * 查询等级
 */
export const queryLevel = () => request.get('/alarm/config/default/level');
