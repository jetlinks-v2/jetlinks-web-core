import { request } from '@jetlinks-web/core'
import { FileStatic, fileUpload } from '@jetlinks-web-core/api/comm'
import type { UploadProps } from 'ant-design-vue'

type UploadCustomRequest = NonNullable<UploadProps['customRequest']>
type UploadRequestOptions = Parameters<UploadCustomRequest>[0]

interface UploadByRequestOptions {
  url?: string
  name?: string
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

export const createUploadCustomRequest = (config: UploadByRequestOptions = {}): UploadCustomRequest => {
  return async (options) => {
    const rawFile = getRawFile(options.file)

    if (!(rawFile instanceof Blob)) {
      options.onError?.(new Error('invalid upload file'))
      return
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

    try {
      const response = config.url
        ? await request.post(config.url, formData)
        : await fileUpload(formData)

      options.onSuccess?.(response)
    } catch (error) {
      options.onError?.(error as Error)
    }
  }
}

export const uploadByRequest = createUploadCustomRequest()

export const createFileUploadCustomRequest = (publicAccess?: boolean) =>
  createUploadCustomRequest({
    url: publicAccess ? FileStatic : `${FileStatic}?options=publicAccess`
  })
