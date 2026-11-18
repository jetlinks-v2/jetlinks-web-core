type HelpLabel = string | (() => string)

export interface DocumentHelpPoint {
  code: string
  key: string
  name: string
  page: string
  location?: string
}

export interface DocumentHelpPointRegistration extends Omit<DocumentHelpPoint, 'name' | 'page' | 'location'> {
  name: HelpLabel
  page: HelpLabel
  location?: HelpLabel
}

const points = new Map<string, DocumentHelpPointRegistration>()

/** 路由和自定义 key 共同标识点位，允许不同页面复用同名 key。 */
export const documentHelpPointId = (code: string, key: string) => JSON.stringify([code, key])

/** 在模块入口注册，管理页无需先访问业务页面即可列出全部点位。 */
export function registerDocumentHelpPoints(registrations: DocumentHelpPointRegistration[]) {
  registrations.forEach(point => points.set(documentHelpPointId(point.code, point.key), { ...point }))
}

/** 每次扫描读取当前注册表并解析语言标签；重复注册只更新同一埋点。 */
export function getDocumentHelpPoints(): DocumentHelpPoint[] {
  return [...points.values()].map(point => ({
    ...point,
    name: typeof point.name === 'function' ? point.name() : point.name,
    page: typeof point.page === 'function' ? point.page() : point.page,
    location: typeof point.location === 'function' ? point.location() : point.location,
  }))
}
