import { request } from '@jetlinks-web/core'

// 获取记录列表
export const getList_api = (data: any): any => request.post(`/notifications/_query`, data)
// 获取有效未读记录列表，后端会合并 read marker 与显式未读状态。
export const getUnreadNoPagingList_api = (data: any): any => request.post(`/notifications/_query/unread/no-paging`, data)
// 获取有效未读数量，后端按 pageSize 做 capped count，避免为角标返回消息正文。
export const getUnreadCount_api = (data: any): any => request.post(`/notifications/_query/unread/count`, data)
// 获取有效未读数量汇总，用于一次性刷新站内信分类角标。
export const getUnreadSummary_api = (data: any): any => request.post(`/notifications/_query/unread/summary`, data)
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
