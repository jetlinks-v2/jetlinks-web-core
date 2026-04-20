import type { StoreDefinition } from 'pinia'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

type AnyStoreDefinition = StoreDefinition<string, any, any, any>

/**
 * 检查给定的值是否为存储定义(StoreDefinition)
 * @param value 需要检查的值，类型为unknown
 * @returns 返回一个布尔值，表示该值是否为AnyStoreDefinition类型
 */
const isStoreDefinition = (value: unknown): value is AnyStoreDefinition => { // 使用类型谓词检查value是否为AnyStoreDefinition类型
  return typeof value === 'function' && typeof (value as AnyStoreDefinition).$id === 'string'
}

const getModuleOverrideStore = (
  storeId: string,
  fallbackStore?: AnyStoreDefinition,
): AnyStoreDefinition | undefined => {
  const modules = Array.from(moduleRegistry.getAllModules().values())

  for (let index = modules.length - 1; index >= 0; index -= 1) {
    const moduleStores = modules[index]?.stores

    if (!moduleStores) continue

    const matchedStore = Object.values(moduleStores).find((store) => {
      return isStoreDefinition(store) && store.$id === storeId && store !== fallbackStore
    })

    if (matchedStore) {
      return matchedStore
    }
  }

  return undefined
}

export const withModuleStoreOverride = <T extends AnyStoreDefinition>(useStore: T): T => {
  const wrappedStore = ((...args: Parameters<T>): ReturnType<T> => {
    const overrideStore = getModuleOverrideStore(useStore.$id, useStore) as T | undefined
    return (overrideStore || useStore)(...args)
  }) as T

  Object.assign(wrappedStore, useStore)

  return wrappedStore
}
