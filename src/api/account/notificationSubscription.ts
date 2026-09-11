import { request } from '@jetlinks-web/core'

export type SubscriptionState = 'enabled' | 'disabled'

// 获取通知订阅列表
export const getNoticeList_api = (query: Record<string, unknown> = {}) =>
  request.post(`/notifications/subscriptions/_query`, query);
// 保存通知订阅
export const save_api = (data:any) => request.patch(`/notifications/subscribe`, data);

// 修改当前用户订阅状态，保留订阅实体及已选通知渠道
export const changeSubscriptionState_api = (id: string, state: SubscriptionState) =>
  request.put(`/notifications/subscription/${encodeURIComponent(id)}/_${state}`, {});

// 获取订阅类型
export const getTypeList_api = () => request.get(`/notifications/providers`);

//获取订阅类型 新
export const getTypeListNew = (type:string) => request.get(`/notifications/current/${type}/providers`)

// 判断获取当前用户绑定信
export const getIsBindThird = () => request.get(`/user/third-party/me`);

// 生成OAuth2授权URL
export const getWechatOAuth2 = (configId: string, templateId: string, url: string) => request.get(`/notifier/wechat/corp/${configId}/${templateId}/oauth2/binding-user-url?redirectUri=${url}`);

export const getDingTalkOAuth2 = (configId: string, url: string) => request.get(`/notifier/dingtalk/corp/${configId}/oauth2/binding-user-url?authCode=${url}`);

// 获取oauth2授权的用户绑定码

export const getUserBind = (type: 'wechat' | 'dingtalk', params: any) => request.get(`/notifier/${type}/corp/oauth2/user-bind-code`, params);

// 根据绑定码绑定当前用户
export const bindThirdParty = (type: string, provider: string, bindCode: string) => request.post(`/user/third-party/me/${type}/${provider}/${bindCode}/_bind`);



