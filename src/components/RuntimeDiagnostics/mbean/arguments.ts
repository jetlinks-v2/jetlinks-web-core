import type { MBeanOperation } from '../types'

/** 参数按签名顺序读取，使用下标避免重名或缺名参数互相覆盖。 */
export function mbeanInvocationArguments(operation: MBeanOperation, values: Array<string | undefined>) {
  return operation.parameters.map((parameter, index) => {
    const value = values[index]
    if (value === undefined || value === '' && parameter.type !== 'java.lang.String') throw new Error('required')
    const structured = /^(java\.util\.|\[)/.test(parameter.type) || parameter.type.endsWith('[]')
    return { name: parameter.name, value: structured ? JSON.parse(value) as unknown : value }
  })
}
