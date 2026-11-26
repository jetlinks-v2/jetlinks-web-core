import { builtInLanguage, canonicalLanguage, DEFAULT_LANGUAGE, type BuiltInLanguage } from '../languages'

type Messages = Readonly<Record<string, unknown>>
type Pattern = { expression: RegExp; language: BuiltInLanguage }
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const han = /\p{Script=Han}/u
const kana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u
const hangul = /\p{Script=Hangul}/u
const latin = /\p{Script=Latin}/u

/** 结合语种标记、词库和字形，识别当前内置词库渲染出的源文本。 */
export class PageSourceCatalog {
  private readonly exact = new Map<string, Set<BuiltInLanguage>>()
  private readonly patterns = new Map<string, Pattern[]>()

  constructor(messages: Messages, private readonly isKnownText?: (text: string) => boolean) {
    for (const [locale, dictionary] of Object.entries(messages)) {
      const language = builtInLanguage(locale)
      if (language) this.index(dictionary, language)
    }
  }

  isSourceText(text: string, source: BuiltInLanguage, hint?: string): boolean {
    const hasHan = han.test(text)
    const hasKana = kana.test(text)
    if (!(source === 'zh' ? hasHan : source === 'ja' ? hasHan || hasKana : latin.test(text))) return false
    if (hint) {
      const tag = canonicalLanguage(hint)
      if (!tag) return false
      const { language, script } = new Intl.Locale(tag).maximize()
      return language === source && (source !== 'zh' || script === 'Hans')
    }

    if (hangul.test(text) || (source !== 'ja' && hasKana)) return false
    const exact = this.exact.get(text)
    if (exact) return exact.has(source)
    if (this.isKnownText?.(text)) return true

    // 纯汉字的日文依赖词库、已知菜单或显式标记，避免把服务端中文当作日文输入。
    const matches = this.patternLanguages(text)
    return matches ? matches.has(source) : source === 'ja' ? hasKana : source === 'en' ? !hasHan : hasHan
  }

  /** 识别整页翻译的源语种，词库外的汉字文案回退到系统默认语种。 */
  supplementSource(text: string, target: BuiltInLanguage, hint?: string): string | undefined {
    if (hint) {
      const tag = canonicalLanguage(hint)
      if (!tag) return
      const { language, script } = new Intl.Locale(tag).maximize()
      const source = language === 'zh' && script === 'Hant' ? 'zh-Hant' : language
      return source === target ? undefined : source
    }

    const matches = this.exact.get(text) ?? this.patternLanguages(text)
    if (matches?.has(target) || this.isKnownText?.(text)) return
    if (matches?.size === 1) return matches.values().next().value

    let source: string = DEFAULT_LANGUAGE
    if (kana.test(text)) source = 'ja'
    else if (hangul.test(text)) source = 'ko'
    else if (!han.test(text) && latin.test(text)) source = 'en'
    return source === target ? undefined : source
  }

  private patternLanguages(text: string): Set<BuiltInLanguage> | undefined {
    let matches: Set<BuiltInLanguage> | undefined
    for (const patterns of [this.patterns.get(text[0]), this.patterns.get('')]) {
      for (const pattern of patterns ?? []) {
        if (pattern.expression.test(text)) (matches ??= new Set()).add(pattern.language)
      }
    }
    return matches
  }

  private index(value: unknown, language: BuiltInLanguage): void {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) this.index(child, language)
      return
    }
    if (typeof value !== 'string') return
    const text = value.trim()
    if (!text || text.includes('|') || /@[:.]/.test(text)) return
    const tokens = [...text.matchAll(/\{\w+\}/g)]
    if (tokens.length === 0) {
      const entries = this.exact.get(text) ?? new Set<BuiltInLanguage>()
      entries.add(language)
      this.exact.set(text, entries)
      return
    }
    if (tokens.length > 3 || !/\p{L}/u.test(text.replace(/\{\w+\}/g, ''))) return
    let afterLast = 0
    let expression = '^'
    for (const token of tokens) {
      expression += escapeRegExp(text.slice(afterLast, token.index)) + '(.+?)'
      afterLast = token.index + token[0].length
    }
    const first = tokens[0].index === 0 ? '' : text[0]
    const patterns = this.patterns.get(first) ?? []
    patterns.push({ expression: new RegExp(expression + escapeRegExp(text.slice(afterLast)) + '$'), language })
    this.patterns.set(first, patterns)
  }
}

export function excludedText(text: string): boolean {
  return !text || text.length > 5000
    || /<\/?[a-z][^>]*>|```|\{\{|\$\{|(?:https?|wss?):\/\/|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text)
    || /^[\d\s\p{P}\p{S}]+$/u.test(text)
    || /^(?:[a-z\d]+(?:[-_./:][a-z\d]+)+|(?=.*[a-z])(?=.*\d)[a-z\d]+)$/i.test(text)
}

/** 空译文或明显退化的重复输出不应覆盖业务原文。 */
export function usableTranslation(text: string, result: string): boolean {
  const repeated = /([\p{L}\p{N}]{1,24})(?:[\s\p{P}\p{S}]+\1){4,}(?![\p{L}\p{N}])/iu
  return !!result.trim() && (!repeated.test(result) || repeated.test(text))
}
