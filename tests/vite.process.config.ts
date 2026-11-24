import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { federation } from '@jetlinks-web/vite'
import { getFederationSetting, v3Token, legacyLessVariables } from '../vite.setting'
import { registerModulesAlias } from '../configs/plugin/modules'
import AutoImport from 'unplugin-auto-import/vite'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
const sdk = createRequire(resolve(__dirname,'../package.json')).resolve('@jetlinks-web/core')
const federationOptions = getFederationSetting('',resolve(__dirname,'../..'))

/** 真实过程组件和 HTTP API；对象目录与设备端点由显式测试夹具提供。 */
export default defineConfig(async () => ({
  clearScreen:false,
  root:resolve(__dirname,'..'),
  cacheDir:resolve(__dirname,'../.vite-process'),
  plugins:[vue(),vueJsx(),AutoImport({imports:['vue','vue-router'],dts:false}),federation({...federationOptions,
    shared:federationOptions.shared.filter(name => name !== '@jetlinks-web/core'),
  })],
  resolve:{alias:{
    ...registerModulesAlias(),
    '@theme-config':resolve(__dirname,'../configs/theme/index.ts'),
    '@process-test-sdk':sdk,
    '@jetlinks-web/core':resolve(__dirname,'process-preview-http.ts'),
    '@jetlinks-web-core':resolve(__dirname,'../src'),
    '@':resolve(__dirname,'../src'),
    '@rule-engine-manager-ui':resolve(__dirname,'../../modules/rule-engine-manager-ui'),
  }},
  css:{preprocessorOptions:{less:{javascriptEnabled:true,modifyVars:{...legacyLessVariables,...await v3Token(resolve(__dirname,'../..'))}}}},
  server:{host:'127.0.0.1',port:5194,strictPort:true,fs:{allow:[resolve(__dirname,'../../..')]},proxy:{
    '/process':'http://127.0.0.1:18944',
    '/fixture':'http://127.0.0.1:18944',
  }},
  build:{outDir:resolve(__dirname,'../dist-process-test'),rollupOptions:{input:resolve(__dirname,'process-preview.html')}},
}))
