import { defineAsyncComponent, type Component } from 'vue'

type SvgIconLoader = () => Promise<Component>

const MODULE_ICON_PATH = /^\.\.\/\.\.\/\.\.\/\.\.\/modules\/([^/]+)\/icons\/(.+)\.svg$/
const CORE_ICON_PATH = /^\.\.\/\.\.\/icons\/(.+)\.svg$/
const svgIconModules = import.meta.glob<Component>([
  '../../../../modules/*/icons/**/*.svg',
  '../../icons/**/*.svg',
], {
  import: 'default',
  query: '?component',
})
console.log(svgIconModules)
const svgIconLoaders = Object.entries(svgIconModules).reduce<Record<string, SvgIconLoader>>(
  (loaders, [path, loader]) => {
    const moduleMatched = MODULE_ICON_PATH.exec(path)
    const coreMatched = CORE_ICON_PATH.exec(path)
    const type = moduleMatched
      ? `${moduleMatched[1]}/${moduleMatched[2]}`
      : coreMatched
        ? coreMatched[1]
        : undefined

    if (type) loaders[type] = loader
    return loaders
  },
  {},
)

const svgIconCache = new Map<string, Component>()

export type SvgIconType = string

export const svgIconTypes = Object.freeze(Object.keys(svgIconLoaders))

/**
 * 按“模块目录/图标相对路径”获取 SVG 组件，例如 `device-manager-ui/device/status`
 * 或核心模块中的 `navigation/arrow-right`。
 */
export function getSvgIcon(type: SvgIconType): Component | undefined {
  const cachedIcon = svgIconCache.get(type)
  if (cachedIcon) return cachedIcon

  const loader = svgIconLoaders[type]
  if (!loader) return undefined

  const icon = defineAsyncComponent(loader)
  svgIconCache.set(type, icon)
  return icon
}
