export const frontLanguageLabels = { zh: '中文', en: 'English', ja: '日本語' } as const
export type FrontLanguage = keyof typeof frontLanguageLabels

export const defaultFrontLanguages = ['zh', 'en', 'ja'] as const
export const frontLanguageOptions = defaultFrontLanguages.map(value => ({ value, label: frontLanguageLabels[value] }))

export const isFrontLanguage = (value: unknown): value is FrontLanguage => (
  typeof value === 'string' && Object.hasOwn(frontLanguageLabels, value)
)

export const parseFrontLanguages = (value: unknown): FrontLanguage[] => (
  Array.isArray(value) ? [...new Set(value.filter(isFrontLanguage))] : []
)
