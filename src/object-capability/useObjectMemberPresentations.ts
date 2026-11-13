import { computed, onScopeDispose, ref, type Ref } from 'vue'
import { moduleRegistry } from '../utils/module-registry'
import type { ObjectMemberPresentation } from './types'

export function useObjectMemberPresentations(type: Readonly<Ref<string | undefined>>) {
  const revision = ref(0)
  onScopeDispose(moduleRegistry.onChange(() => revision.value++))
  return computed(() => {
    void revision.value
    const items = new Map<string, ObjectMemberPresentation>()
    for (const module of moduleRegistry.getAllModules().values())
      for (const entry of Object.values(module.objectPresentations || {}))
        if (entry.typeId === type.value) for (const member of entry.members || [])
          items.set(JSON.stringify(member.ref), member)
    return [...items.values()]
  })
}
