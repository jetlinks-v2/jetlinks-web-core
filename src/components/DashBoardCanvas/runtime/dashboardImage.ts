import { getImage, getToken, LocalStore } from '@jetlinks-web/utils'
import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import {
  getBaseApi,
  getProjectIdFromLocation,
  getProjectStorage,
  isProjectStorageEnabled
} from '@jetlinks-web-core/utils'

const PERSONAL_TOKEN_KEY = import.meta.env.VITE_PERSONAL_TOKEN_KEY
const PERSONAL_TOKEN_KEY_URL = import.meta.env.VITE_PERSONAL_TOKEN_URL_KEY

/**
 *  获取个人token
 * @returns
 */
function getPersonalToken() {
  const urlParams = new URLSearchParams(window.location.search)
  const releaseId = urlParams.get('releaseId')
  if (!releaseId) return null
  const key = `${PERSONAL_TOKEN_KEY}_${releaseId}`
  return LocalStore.get(key)
}

const getProjectStorageInfo = () => {
  if (!isProjectStorageEnabled()) return undefined

  const projectId = getProjectIdFromLocation()
  return projectId ? getProjectStorage(projectId) : undefined
}

/**
 * 获取文件url
 * @param id 文件id
 * @param thumb 压缩参数
 * @returns
 */
const getFileUrlById = (id: string, thumb?: string) => {
  const storage = getProjectStorageInfo()
  const systemToken = storage?.token || getToken()
  //压缩参数
  const thumbParam = thumb ? `&thumb=${thumb}` : ''
  const token = systemToken ? `${TOKEN_KEY_URL}=${systemToken}` : `${PERSONAL_TOKEN_KEY_URL}=${getPersonalToken()}`
  const baseURL = storage?.apiUrl || getBaseApi()

  if (id.startsWith('vis/')) {
    return `${baseURL}/ui/${id}?${token}${thumbParam}`
  }

  return `${baseURL}/file/${id}?${token}${thumbParam}`
}

interface ThumbnailData {
  thumbnailUrl: string
  thumb?: string
}

/**
 * 为了区分是本地的图片还是线上的图片
 * @param id
 * @param thumb 压缩参数: 长_宽
 */
const getImageUrl = (id: string, thumb?: string) => {
  if (!id) return ''
  if (id.includes('localhost')) {
    return getImage(id.replace('localhost', ''))
  }
  return getFileUrlById(id, thumb)
}

/** 保留仪表盘本地图片的同步地址解析和系统 token 优先规则。 */
export const getDashboardImageUrl = (type: 'thumbnail', data: ThumbnailData) => {
  const fallbackUrl = '/images/login/login.png'

  if (type === 'thumbnail') {
    const { thumbnailUrl, thumb } = data as ThumbnailData
    if (!thumbnailUrl) {
      return fallbackUrl
    }

    return getImageUrl(thumbnailUrl, thumb)
  }
  return fallbackUrl
}
