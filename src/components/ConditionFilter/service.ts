import { request } from '@jetlinks-web/core'

/** Load dictionary candidates through the shared authenticated request client. */
export const loadConditionDictionaryOptions = (dictionaryId: string) =>
  request.get(`/dictionary/${encodeURIComponent(dictionaryId)}/items`)
