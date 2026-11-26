import type { LanguagePair } from '../models'
import pack from './pack.json'

export const localPackName = `jetlinks-translation-${pack.version}`
export const localPackPath = `local-translation/${pack.version}/`
export const localPackVersion = pack.version
export const localPackFiles = [
  ...pack.modelFiles.map(file => ({ path: `model/${file.path}`, size: file.size })),
  ...pack.runtimeFiles,
]

const supportedLanguages = new Set(['zh', 'en', 'ja', 'ko', 'zh-Hant'])

export function supportsLocalPair(pair: LanguagePair): boolean {
  return pair.sourceLanguage !== pair.targetLanguage
    && supportedLanguages.has(pair.sourceLanguage) && supportedLanguages.has(pair.targetLanguage)
}

export function needsNeuralModel({ sourceLanguage, targetLanguage }: LanguagePair): boolean {
  return sourceLanguage !== 'zh' || targetLanguage !== 'zh-Hant'
}

export type LocalRequest = { id: number } & (
  | { type: 'cancel' }
  | { type: 'prepare'; pair: LanguagePair; packUrl: string }
  | { type: 'translate'; pair: LanguagePair; packUrl: string; text: string }
)

export type LocalReply = { id: number; result?: string; error?: string }
