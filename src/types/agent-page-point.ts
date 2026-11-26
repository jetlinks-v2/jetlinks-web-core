/** 页面功能点目录声明。注册目录不代表部署智能体或授予资产权限。 */
export interface AgentPagePointDeclaration {
  clientType: 'pagePoint'
  clientId: string
  name: string
  description?: string
  searchCode?: string
  maxAgentSize: number
  order?: number
  expands: {
    type: 'chatBubbles' | 'button' | 'chatMenu'
    menuName?: string
  }
  metadata?: Record<string, unknown>
}
