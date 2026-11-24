import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { build, createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
const root = fileURLToPath(new URL('..', import.meta.url))
const config = {root,configFile:false,plugins:[{name:'preview-upload-context',enforce:'pre',resolveId(id,importer){
  if (id === '../../utils' && importer?.includes('/MetadataValueItem/index.vue')) return '\0preview-upload-context'
},load(id){if(id === '\0preview-upload-context') return 'export const getUploadHeaders = () => ({})'}},vue(),AutoImport({imports:['vue'],dts:false})],resolve:{alias:{'@jetlinks-web/core':resolve(root,'tests/process-preview-http.ts'),'@jetlinks-web-core':resolve(root,'src')}},optimizeDeps:{entries:['tests/process-preview.html']}}
if (process.argv.includes('--build')) await build({...config,build:{outDir:'/private/tmp/process-preview-build',emptyOutDir:true,rollupOptions:{input:resolve(root,'tests/process-preview.html')}}})
else { const server = await createServer({...config,server:{host:'127.0.0.1',port:5191,strictPort:true,proxy:{'/process':{target:'http://127.0.0.1:18941'},'/fixture':{target:'http://127.0.0.1:18941'}}}}); await server.listen(); server.printUrls() }
