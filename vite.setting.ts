import { theme } from 'ant-design-vue/lib'
import customTheme from './configs/theme'
import convertLegacyToken from 'ant-design-vue/lib/theme/convertLegacyToken'
import path from 'path'

export const v3Token = () => {
  const { defaultAlgorithm, defaultSeed } = theme
  const mapToken = defaultAlgorithm({ ...defaultSeed, ...customTheme })
  console.log('v3Token', convertLegacyToken)
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

export const getDefine = (env: Partial<ImportMetaEnv>, mode: string, isDev: boolean, mavenName: string ) => {

  const envDefine = Object.entries(env).reduce((acc, [key, val]) => {
    if (key.startsWith('VITE_')) {
      acc[`import.meta.env.${key}`] = JSON.stringify(val)
    }
    return acc
  }, {} as Record<string, string>)

  envDefine['import.meta.env.BASE_URL'] = JSON.stringify('./')
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
