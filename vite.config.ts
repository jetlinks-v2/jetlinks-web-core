import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { VueAmapResolver } from '@vuemap/unplugin-resolver'
import VueSetupExtend from 'vite-plugin-vue-setup-extend'
import monacoEditorPlugin from './configs/plugin/monaco-editor'
import progress from 'vite-plugin-progress'
import * as path from 'path'
import {
  registerModulesAlias,
  copyFile,
  loadViteModulesPlugins
} from './configs/plugin'
import { federation, sharpOptimize } from '@jetlinks-web/vite'

import { antdLegacyVarsPlugin } from './configs/plugin/antd-legacy-vars-plugin'
import { getDefine, getFederationSetting, v3Token } from './vite.setting'
import { moduleFilterPlugin } from './configs/plugin/moduleFilterPlugin'

// 开发服务器插件 - 用于在开发模式下设置全局变量
const devServerPlugin = (targetModule?: string) => {
  return {
    name: 'dev-server-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (targetModule && req.url?.endsWith('.html')) {
          const originalEnd = res.end
          res.end = function(...args) {
            let html = ''
            if (args[0]) {
              html = args[0].toString()
            }
            // 在 </body> 前注入脚本
            const script = `<script>window.__JETLINKS_TARGET_MODULE__='${targetModule}'</script>`
            html = html.replace('</body>', `${script}</body>`)
            args[0] = html
            return originalEnd.apply(this, args)
          }
        }
        next()
      })
    }
  }
}

const federationSharedMap = {
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

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const envDir = path.resolve(__dirname, '..')
  const env: Partial<ImportMetaEnv> = loadEnv(mode, envDir, '')

  const moduleNameIndex = process.argv.indexOf('--module-name')
  let mavenNames: string[] | null = null

  if (moduleNameIndex !== -1) {
    const moduleNameStr = process.argv[moduleNameIndex + 1]
    // 支持逗号分隔的多个模块名
    mavenNames = moduleNameStr ? moduleNameStr.split(',').map(name => name.trim()) : null
  }

  // 解析后端地址参数
  const backendUrlIndex = process.argv.indexOf('--backend-url')
  let backendUrl = backendUrlIndex !== -1 ? process.argv[backendUrlIndex + 1] : null

  // 自动添加 http:// 前缀（如果用户未输入）
  if (backendUrl && !backendUrl.match(/^https?:\/\//)) {
    backendUrl = `http://${backendUrl}`
  }

  // 兼容单个模块名的场景（向后兼容）
  // 如果是单个模块，传递模块名；如果是多个模块，传递null使用默认host配置
  const mavenName = mavenNames && mavenNames.length === 1 ? mavenNames[0] : null

  const isDev = command === 'serve'
  const envDefine = getDefine(env, mode, isDev, mavenName)

  // 开发服务器插件配置
  const devPlugin = isDev && mavenNames && mavenNames.length > 0 ? devServerPlugin(mavenNames.join(',')) : null

  return {
    envDir,
    base: './',
    resolve: {
      alias: {
        '@jetlinks-web-core': path.resolve(__dirname, 'src'),
        ...registerModulesAlias()
      }
    },
    define: envDefine,
    build: {
      outDir: mavenName ? path.resolve(envDir, `modules/${mavenName}/dist`) : 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      cssCodeSplit: false,
      manifest: true,
      chunkSizeWarningLimit: 2000,
      assetsInlineLimit: 1000,
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name].${new Date().getTime()}.js`,
          chunkFileNames: `assets/[name].${new Date().getTime()}.js`,
          assetFileNames: (pre) => {
            const fileType = pre.name.split('.')?.pop()
            if (['png', 'svg', 'ico', 'jpg'].includes(fileType)) {
              return `assets/[name].[ext]`
            }
            return `assets/[name].${new Date().getTime()}.[ext]`
          },
          // 如果是模块构建，提取特定的CSS chunks
          ...(mavenName && {
            input: `../modules/${mavenName}/register.ts`
          }),
          compact: true,
          manualChunks: mavenName ? undefined : federationSharedMap
        }
      }
    },
    plugins: [
      vue(),
      vueJsx(),
      VueSetupExtend(),
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService', 'json', 'typescript']
      }),
      antdLegacyVarsPlugin(),
      Components({
        resolvers: [VueAmapResolver()],
        directoryAsNamespace: true
      }),
      AutoImport({
        imports: ['vue', 'vue-router'],
        dts: 'src/auto-imports.d.ts',
        resolvers: [VueAmapResolver()]
      }),
      moduleFilterPlugin(mavenNames),
      progress(),
      copyFile(mavenName),
      ...loadViteModulesPlugins(),
      federation(getFederationSetting(mavenName, envDir)),
      sharpOptimize(),
      // 添加开发服务器插件
      ...(devPlugin ? [devPlugin] : [])
    ],
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT),
      cors: true,
      fs: { allow: [envDir] },
      proxy: {
        [env.VITE_APP_BASE_API]: {
          // 优先使用命令行参数，其次使用环境变量
          target: backendUrl || env.VITE_APP_DEV_PROXY_URL,
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${env.VITE_APP_BASE_API}`), '')
        }
      }
    },
    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            'root-entry-name': 'variable',
            hack: `true; @import (reference) "${path.resolve('src/style/variable.less')}";`,
            ...v3Token()
          },
          javascriptEnabled: true
        }
      }
    },
    optimizeDeps: {
      include: ['pinia', 'vue-router', 'axios', 'lodash-es', '@vueuse/core', 'echarts', 'dayjs'],
      esbuildOptions: {
        define: envDefine
      }
    }
  }
})
