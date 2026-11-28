import { computed, onScopeDispose, ref } from 'vue'
import { moduleRegistry } from '../utils/module-registry'
import { objectPresentationRegistry } from './presentations'

export function useObjectPresentationRegistry() {
  const revision = ref(0)
  onScopeDispose(moduleRegistry.onChange(() => revision.value++))
  return computed(() => {
    void revision.value
    return objectPresentationRegistry([...moduleRegistry.getAllModules().values()].flatMap(module => Object.values(module.objectPresentations || {})))
  })
}
