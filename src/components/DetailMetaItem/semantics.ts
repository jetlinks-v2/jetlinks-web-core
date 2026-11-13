/** 详情摘要按字段语义选图标；时间点和时长、各类对象 ID 共用同一图标。 */
export const detailMetaIcons = {
  id: 'NumberOutlined',
  time: 'ClockCircleOutlined',
  product: 'AppstoreOutlined',
  space: 'EnvironmentOutlined',
  group: 'FolderOutlined',
  category: 'ApartmentOutlined',
  count: 'ClusterOutlined',
  brand: 'BankOutlined',
  model: 'TagOutlined',
  tags: 'TagsOutlined',
  description: 'FileTextOutlined',
} as const

export type DetailMetaKind = keyof typeof detailMetaIcons
