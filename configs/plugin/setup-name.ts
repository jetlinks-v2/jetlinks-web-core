import { parse } from 'vue/compiler-sfc'
import type { Plugin } from 'vite'

/** 兼容旧 name 属性；只补充组件名，Props 类型由官方 Vue 插件按真实文件路径解析。 */
export function setupNamePlugin(): Plugin {
  return {
    name: 'jetlinks-setup-name',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.vue')) return null
      const { descriptor } = parse(code, { filename: id })
      const setup = descriptor.scriptSetup
      if (descriptor.script || !setup?.attrs.name) return null
      const name = JSON.stringify(String(setup.attrs.name)).replaceAll('<', '\\u003c')
      // 追加普通 script 保留原文件的行号，也保留原有 defineOptions 的覆盖语义。
      return {
        code: `${code}\n<script${setup.lang ? ` lang="${setup.lang}"` : ''}>\nexport default { name: ${name} }\n</script>\n`,
        map: null,
      }
    },
  }
}
