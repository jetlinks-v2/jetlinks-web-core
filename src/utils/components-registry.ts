import { modules } from '../utils/modules'
import type {
  ActionPosition,
  RegistryAction,
  RegistryActionComponent,
} from '@jetlinks-web-core/types/module'

export type { ActionPosition, RegistryAction, RegistryActionComponent }

export class ComponentsRegistry {
  private registryMap: Map<string, RegistryAction[]> = new Map()

  getKey(action: RegistryAction) {
    return `${action.targetPage}:${action.targetModule || 'default'}`
  }

  /**
   * 注册组件，单个注册
   * @param action
   */
  register(action: RegistryAction) {
    const key = this.getKey(action)
    let actions: RegistryAction[] = []

    if (this.registryMap.has(key)) {
      actions = this.registryMap.get(key)!
    }

    const index = actions.findIndex(item => item.code === action.code)

    if (index !== -1) { // 已存在相同组件
      actions[index] = action
    } else {
      actions.push(action)
    }

    this.registryMap.set(key, actions)
  }

  batchRegister() {
    const _modules = modules()
    Object.values(_modules).forEach((module: any) => {
      const components = module.default?.getRegisterComponents?.() || []
      components.forEach((component: RegistryAction) => this.register(component))
    })
  }

  getRegistry(code: string) {
    return (this.registryMap.get(code) || []) as RegistryActionComponent[]
  }
}

export const componentsRegistry = new ComponentsRegistry()
