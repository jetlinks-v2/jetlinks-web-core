import type { UploadFile } from 'ant-design-vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadFileByUrl, onlyMessage } from '@jetlinks-web/utils'
import { getImageUrl } from '@jetlinks-web-core/utils'

export interface FileUploadResponse {
  success?: boolean
  result?: {
    id?: string
    accessUrl?: string
    others?: { accessKey?: string }
  }
}

type DownloadFile = UploadFile<unknown>

/** 自定义上传可返回其他格式；仅在响应为对象时读取平台文件字段。 */
export function getFileUploadResponse(file: DownloadFile): FileUploadResponse | undefined {
  if (file.response && typeof file.response === 'object') return file.response as FileUploadResponse
}

/** 回显列表可省略状态；上传中、失败或无访问地址的文件不可下载。 */
export function getFileDownloadUrl(file: DownloadFile): string | undefined {
  const response = getFileUploadResponse(file)
  if ((file.status && file.status !== 'done' && file.status !== 'success') || response?.success === false) return
  try {
    const result = response?.result
    let value = file.url || result?.accessUrl
    if (!value && typeof result?.id === 'string' && result.id) {
      const url = new URL(getImageUrl(result.id), window.location.href)
      if (typeof result.others?.accessKey === 'string') url.searchParams.set('accessKey', result.others.accessKey)
      value = url.href
    }
    if (typeof value !== 'string' || !value) return
    const url = new URL(value, window.location.href)
    if (['http:', 'https:', 'blob:', 'data:'].includes(url.protocol)) return value
  } catch {
    return
  }
}

/** 文件服务器未开放跨源读取时交由原生链接下载，保留当前编辑表单。 */
function downloadByLink(url: string, name: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** 下载只响应点击；跨源优先转为 Blob 保留文件名，不支持读取时交给文件服务器。 */
export function useFileDownload() {
  const { t } = useI18n()
  const downloading = ref(new Set<string>())
  const canDownload = (file: DownloadFile) => Boolean(getFileDownloadUrl(file))
  const isDownloading = (file: DownloadFile) => downloading.value.has(file.uid)

  const handleDownload = async (file: DownloadFile) => {
    const url = getFileDownloadUrl(file)
    if (!url || isDownloading(file)) return
    const target = new URL(url, window.location.href)
    if (target.origin === window.location.origin || ['blob:', 'data:'].includes(target.protocol)) {
      downloadFileByUrl(url, file.name)
      return
    }
    downloading.value.add(file.uid)
    try {
      // 跨源的 download 属性会被忽略，先读取 Blob；CORS/网络限制时由服务器响应决定下载。
      let response: Response
      try {
        response = await fetch(url)
      } catch {
        downloadByLink(url, file.name)
        return
      }
      if (!response.ok) throw new Error('File download failed')
      const objectUrl = URL.createObjectURL(await response.blob())
      try {
        downloadFileByUrl(objectUrl, file.name)
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      }
    } catch {
      onlyMessage(t('Upload.File.downloadFailed'), 'error')
    } finally {
      downloading.value.delete(file.uid)
    }
  }

  return { canDownload, isDownloading, handleDownload }
}
