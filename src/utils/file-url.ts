type FileUrlResolver = (id: string) => string | undefined

let resolver: FileUrlResolver | undefined

/** 宿主可提供文件 URL；不安装或返回空值时，文件 API 沿用平台地址。 */
export const installFileUrlResolver = (value: FileUrlResolver): (() => void) => {
  resolver = value
  return () => { if (resolver === value) resolver = undefined }
}

export const resolveFileUrl = (id: string): string | undefined => resolver?.(id)
