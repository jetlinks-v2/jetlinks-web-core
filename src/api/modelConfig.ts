import { request } from '@jetlinks-web/core'

export interface ModelFile {
  id: string
  modelId?: string
  modelVersion?: number
  name: string
  path?: string
  fileKey?: string
  score?: number
  url?: string
  md5?: string
  sha256?: string
  format?: string[]
}

export interface ModelFormatTag {
  id: string
  name?: string
}

export const queryModelFiles = (modelId: string, params: { version: string | number; format: string }) => {
  return request.get(`/ai/model/${modelId}/file/_all`, params)
}

export const queryModelFormatTags = () => {
  return request.get('/ai/model/tag/_all')
}

export const saveModelFormats = (modelId: string, data: Record<string, any>) => {
  return request.post(`/ai/model/${modelId}`, data)
}

export const saveModelFile = (modelId: string, format: string, data: Record<string, any>) => {
  return request.post(`/ai/model/${modelId}/file/_save?format=${encodeURIComponent(format)}`, data)
}
