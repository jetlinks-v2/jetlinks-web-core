export interface ModelFile {
  id: string
  modelId?: string
  name: string
  path?: string
  fileKey?: string
  url?: string
  internalUrl?: string
  size?: number
  md5?: string
  sha256?: string
  format?: string[]
  content?: string
  local?: boolean
  extract?: boolean
}

export interface TreeNode {
  title: string
  key: string
  path?: string
  isFile?: boolean
  shared?: boolean
  file?: ModelFile
  children?: TreeNode[]
}

export interface FileDirectorySource {
  treeData: TreeNode[]
  formatNames: Map<string, string>
  locale: Record<string, string | undefined>
}
