import { theme } from 'ant-design-vue/lib'
import customTheme from './configs/theme'
import convertLegacyToken from 'ant-design-vue/lib/theme/convertLegacyToken'
import path from 'path'

export const v3Token = () => {
  const { defaultAlgorithm, defaultSeed } = theme
  const mapToken = defaultAlgorithm({ ...defaultSeed, ...customTheme })
  return convertLegacyToken(mapToken)
}

export const federationSharedMap = {
  vue: ['vue'],
  'vue-router': ['vue-router'],
  pinia: ['pinia'],
  'vue-i18n': ['vue-i18n'],
  'lodash-es': ['lodash-es'],
  echarts: ['echarts'],
  '@jetlinks-web/core': ['@jetlinks-web/core'],
  '@jetlinks-web/hooks': ['@jetlinks-web/hooks'],
  '@jetlinks-web/constants': ['@jetlinks-web/constants']
  // '@jetlinks-web/utils': ['@jetlinks-web/utils'],
}

export const getDefine = (
  env: Partial<ImportMetaEnv>,
  mode: string,
  isDev: boolean,
  mavenName: string,
  publicPath: string
) => {

  const envDefine = Object.entries(env).reduce((acc, [key, val]) => {
    if (key.startsWith('VITE_')) {
      acc[`import.meta.env.${key}`] = JSON.stringify(val)
    }
    return acc
  }, {} as Record<string, string>)

  envDefine['import.meta.env.BASE_URL'] = JSON.stringify(publicPath)
  envDefine['import.meta.env.MODE'] = JSON.stringify(mode)
  envDefine['import.meta.env.DEV'] = String(isDev)
  envDefine['import.meta.env.PROD'] = String(!isDev)
  envDefine['import.meta.env.SSR'] = 'false'
  envDefine['import.meta.env.VITE_MODULE_NAME'] = JSON.stringify(mavenName)

  return envDefine
}

export const getFederationSetting = (mavenName: string, envDir: string) => {
  return {
    name: mavenName ? `${mavenName}` : 'host',
    remotes: {},
    enableDynamicRemotes: true,
    filename: mavenName ? 'remoteEntry.js' : undefined,
    isHost: true,
    shared: Object.keys(federationSharedMap),
    exposes: mavenName
      ? {
        [mavenName]: path.resolve(envDir, `modules/${mavenName}/register.ts`)
      }
      : undefined
  }
}

export const getModulesName = (): { moduleNames?: string[], moduleName?: string } => {
  const moduleNameIndex = process.argv.indexOf('--module-name')
  let moduleNames: string[] | null = null

  if (moduleNameIndex !== -1) {
    const moduleNameStr = process.argv[moduleNameIndex + 1]
    // 支持逗号分隔的多个模块名
    moduleNames = moduleNameStr ? moduleNameStr.split(',').map(name => name.trim()) : null
  }

  // 兼容单个模块名的场景（向后兼容）
  // 如果是单个模块，传递模块名；如果是多个模块，传递null使用默认host配置
  const moduleName = moduleNames && moduleNames.length === 1 ? moduleNames[0] : null

  return {
    moduleNames,
    moduleName
  }
}

export const getProxyUrl = () => {
  // 解析后端地址参数
  const backendUrlIndex = process.argv.indexOf('--backend-url')
  let backendUrl = backendUrlIndex !== -1 ? process.argv[backendUrlIndex + 1] : null

  // 自动添加 http:// 前缀（如果用户未输入）
  if (backendUrl && !backendUrl.match(/^https?:\/\//)) {
    backendUrl = `http://${backendUrl}`
  }

  return backendUrl
}
