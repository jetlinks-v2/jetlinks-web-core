import { useSystemStore } from '@jetlinks-web-core/store/system'
import {
  normalizeThemeStyle,
  themeStyleOptions,
  type ThemeStyleKey
} from '@jetlinks-web-core/utils'

export interface HeaderThemeModel {
  headerTheme: ThemeStyleKey
}

export const useHeaderTheme = () => {
  const system = useSystemStore()

  const normalizeHeaderTheme = (style?: unknown) => normalizeThemeStyle(style)

  const applyHeaderTheme = (style?: unknown) => {
    const themeStyle = normalizeHeaderTheme(style)
    system.changeThemeStyle(themeStyle)
    return themeStyle
  }

  const createHeaderThemeChange = <T extends HeaderThemeModel>(model: T) => {
    return (style: unknown) => {
      model.headerTheme = applyHeaderTheme(style)
    }
  }

  return {
    headerThemeAreas: themeStyleOptions,
    normalizeHeaderTheme,
    applyHeaderTheme,
    createHeaderThemeChange
  }
}
