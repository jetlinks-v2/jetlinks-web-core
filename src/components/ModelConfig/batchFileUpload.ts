export type BatchFileStatus = 'pending' | 'uploading' | 'uploaded' | 'saving' | 'success' | 'error'

export interface BatchFileUploadResult {
  accessUrl?: string
  id?: string
  length?: number
  md5?: string
  sha256?: string
}

export interface BatchFileUploadItem {
  uid: string
  file: File
  originalName: string
  name: string
  overwrite: boolean
  status: BatchFileStatus
  error?: string
  uploadResult?: BatchFileUploadResult
}

export interface BatchFileStatusUpdate {
  status: BatchFileStatus
  error?: string
  uploadResult?: BatchFileUploadResult
}

export type BatchFileStatusUpdater = (index: number, update: BatchFileStatusUpdate) => void

export interface BatchAddFilePayload {
  path?: string
  format?: string[]
  files: BatchFileUploadItem[]
  update?: BatchFileStatusUpdater
  done?: (success?: boolean) => void
}

export interface ExistingModelFile {
  name: string
  path?: string
}
