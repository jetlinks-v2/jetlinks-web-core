import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'
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
  loadViteModulesPlugins,
  buildTimePlugin
} from './configs/plugin'
import { federation, sharpOptimize } from '@jetlinks-web/vite'
import {
  getDefine,
  getFederationSetting,
  getThemeConfigPath,
  v3Token,
  getModulesName,
  getProxyUrl,
  federationSharedMap,
  getMergedEnv
} from './vite.setting'
import { moduleFilterPlugin } from './configs/plugin/moduleFilterPlugin'

export default defineConfig(async ({ mode, command }) => {
  const envDir = path.resolve(__dirname, '..')
  const env = getMergedEnv(mode, envDir)
  const isDev = command === 'serve'
  const publicPath = (env.VITE_PUBLIC_PATH || '/').trim() || '/'
  const themeConfigPath = getThemeConfigPath(envDir)
  const themeV3Token = await v3Token(envDir)

  const { moduleName, moduleNames} = getModulesName()
  const backendUrl = getProxyUrl()

  const envDefine = getDefine(env, mode, isDev, moduleName, publicPath)

  return {
    envDir,
    base: publicPath,
    resolve: {
      alias: {
        '@theme-config': themeConfigPath,
        '@jetlinks-web-core': path.resolve(__dirname, 'src'),
        '@': path.resolve(__dirname, 'src'),
        ...registerModulesAlias()
      }
    },
    define: envDefine,
    build: {
      outDir: moduleName ? path.resolve(envDir, `modules/${moduleName}/dist`) : path.resolve(envDir, `dist`),
      assetsDir: 'assets',
      sourcemap: false,
      cssCodeSplit: false,
      emptyOutDir: true,
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
          ...(moduleName && {
            input: `../modules/${moduleName}/register.ts`
          }),
          compact: true,
          manualChunks: moduleName ? undefined : federationSharedMap
        }
      }
    },
    plugins: [
      tailwindcss(),
      vue(),
      vueJsx(),
      VueSetupExtend(),
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService', 'json', 'typescript']
      }),
      Components({
        resolvers: [VueAmapResolver()],
        directoryAsNamespace: true
      }),
      AutoImport({
        imports: ['vue', 'vue-router'],
        dts: 'src/auto-imports.d.ts',
        resolvers: [VueAmapResolver()]
      }),
      buildTimePlugin(),
      moduleFilterPlugin(moduleNames),
      progress(),
      copyFile(moduleName),
      ...loadViteModulesPlugins(),
      federation(getFederationSetting(moduleName, envDir)),
      sharpOptimize()
    ],
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT),
      cors: true,
      fs: { allow: [ envDir] },
      // watch: {
      //     usePolling: true,
      //     interval: 1000
      // },
      allowedHosts: [
        '.local-host.cn', // 允许的自定义域名
      ],
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
            'font-gray-900': '#1f2429',
            'font-gray-600': '#646c73',
            'font-gray-500': '#8d9399',
            'font-gray-400': '#c3c7cb',
            'font-gray-300': '#e4e6e7',
            'font-gray-200': '#eff0f1',
            'font-gray-50': '#f8f9fa',
            'font-gray-0': '#ffffff',
            'border-base-color': '#d9d9d9',
            ...themeV3Token
          },
          javascriptEnabled: true
        }
      }
    },
    optimizeDeps: {
      entries: ['index.html'],
      include: ['pinia', 'vue-router', 'axios', 'lodash-es', '@vueuse/core', 'echarts', 'dayjs', 'md-editor-v3'],
      esbuildOptions: {
        define: envDefine
      }
    }
  }
})
