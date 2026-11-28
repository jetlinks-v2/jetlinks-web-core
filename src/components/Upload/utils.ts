import { request } from '@jetlinks-web/core'
import { FileStatic } from '@jetlinks-web-core/api/comm'
import type { UploadProps } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'

type UploadCustomRequest = NonNullable<UploadProps['customRequest']>
type UploadRequestOptions = Parameters<UploadCustomRequest>[0]
export interface UploadRequestHandle { abort: () => void }

interface UploadByRequestOptions {
  url?: string
  name?: string
  /** Long uploads use a progress idle deadline instead of the request's total timeout. */
  idleTimeout?: number
}

const getRawFile = (file: UploadRequestOptions['file']) => {
  const uploadFile = file as { originFileObj?: Blob; name?: string }
  return (uploadFile?.originFileObj ?? file) as Blob
}

const getFileName = (file: UploadRequestOptions['file'], rawFile: Blob) => {
  const uploadFile = file as { name?: string }

  if (typeof File !== 'undefined' && rawFile instanceof File && rawFile.name) {
    return rawFile.name
  }

  return uploadFile?.name
}

const appendFormDataValue = (formData: FormData, key: string, value: unknown) => {
  if (value === undefined || value === null) {
    return
  }

  if (value instanceof Blob) {
    formData.append(key, value)
    return
  }

  formData.append(key, String(value))
}

export const createUploadCustomRequest = (config: UploadByRequestOptions = {}) => {
  return (options: UploadRequestOptions): UploadRequestHandle => {
    const rawFile = getRawFile(options.file)

    if (!(rawFile instanceof Blob)) {
      options.onError?.(new Error('invalid upload file'))
      return { abort() {} }
    }

    const formData = new FormData()
    const fieldName = config.name || options.filename || 'file'
    const fileName = getFileName(options.file, rawFile)

    Object.entries(options.data || {}).forEach(([key, value]) => {
      appendFormDataValue(formData, key, value)
    })

    if (fileName) {
      formData.append(fieldName, rawFile, fileName)
    } else {
      formData.append(fieldName, rawFile)
    }

    const controller = new AbortController()
    let cancelled = false
    let loaded = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const clear = () => { if (timer) clearTimeout(timer) }
    const renew = () => {
      clear()
      if (config.idleTimeout) timer = setTimeout(() => {
        cancelled = true
        controller.abort()
        options.onError?.(Object.assign(new Error(String(i18n.global.t('Upload.File.idle'))), { code: 'UPLOAD_IDLE' }))
      }, config.idleTimeout)
    }
    renew()
    void (async () => {
      try {
        const transport = {
          signal: controller.signal,
          ...(config.idleTimeout ? { timeout: 0 } : {}),
          onUploadProgress(event: { loaded: number; total?: number }) {
            if (cancelled) return
            if (event.loaded > loaded) { loaded = event.loaded; renew() }
            options.onProgress?.({ ...event, percent: event.total ? Math.min(100, event.loaded / event.total * 100) : undefined })
          },
        }
        const response = await request.post(config.url || FileStatic, formData, transport)
        if (!cancelled) options.onSuccess?.(response)
      } catch (error) {
        if (!cancelled) options.onError?.(error as Error)
      } finally { clear() }
    })()
    return { abort() { cancelled = true; clear(); controller.abort() } }
  }
}

export const uploadByRequest = createUploadCustomRequest()

export const createFileUploadCustomRequest = (publicAccess?: boolean) =>
  createUploadCustomRequest({
    url: publicAccess ? `${FileStatic}?options=publicAccess` : FileStatic
  })
