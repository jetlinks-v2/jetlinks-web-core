import { isSafeNumber, parse } from 'lossless-json'

/** 在 JSON 解析边界保留大整数及高精度小数，普通数值继续使用 Number。 */
export const parseJsonWithPrecision = (text: string): unknown =>
  parse(text, undefined, value => isSafeNumber(value) ? Number(value) : value)

/** 供指定 HTTP 接口使用；空响应和非 JSON 响应沿用 Axios 的返回方式。 */
export const parseJsonResponseWithPrecision = (data: unknown): unknown => {
  if (typeof data !== 'string' || !data.trim()) return data
  try {
    return parseJsonWithPrecision(data)
  } catch (error) {
    if (error instanceof SyntaxError) return data
    throw error
  }
}
