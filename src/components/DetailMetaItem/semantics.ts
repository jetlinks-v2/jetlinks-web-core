/** 详情摘要按字段语义选图标，区分上报、创建与通用时间。 */
export const detailMetaIcons = {
  id: 'NumberOutlined',
  time: 'ClockCircleOutlined',
  report: 'HistoryOutlined',
  created: 'CalendarOutlined',
  product: 'AppstoreOutlined',
  space: 'EnvironmentOutlined',
  group: 'FolderOutlined',
  category: 'ApartmentOutlined',
  count: 'ClusterOutlined',
  brand: 'BankOutlined',
  model: 'TagOutlined',
  access: 'ApiOutlined',
  version: 'DeploymentUnitOutlined',
  tags: 'TagsOutlined',
  description: 'FileTextOutlined',
} as const

export type DetailMetaKind = keyof typeof detailMetaIcons
