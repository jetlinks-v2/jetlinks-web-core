import { defineComponent, type PropType } from 'vue'
import { componentsRegistry } from '../../utils/components-registry'
import { useRegistryVNodeMerge } from '../../hooks/useRegistryComponentsMerge'
import { BASIS_FORM_MODULE_CODE, BASIS_FORM_PAGE_CODE, resolveBasisFormFieldActions } from './fieldRegistry'

const groups = {
  appearance: ['title', 'logo', 'ico', 'background', 'showRecordNumber'],
  map: ['apiKey', 'secretKey', 'webKey'],
  address: ['base-path'],
}
const known = Object.values(groups).flat()

/** Route each extension to its field's card; unanchored extensions render once after the shared cards. */
export default defineComponent({
  name: 'PlatformSettingsFields',
  props: { group: { type: String as PropType<keyof typeof groups>, required: true } },
  setup(props, { slots, attrs }) {
    const nodes = useRegistryVNodeMerge(
      () => slots.default?.() || [],
      () => resolveBasisFormFieldActions(componentsRegistry.getRegistry(`${BASIS_FORM_PAGE_CODE}:${BASIS_FORM_MODULE_CODE}`)).filter(item =>
        groups[props.group].includes(String(item.target))
        || props.group === 'address' && !known.includes(String(item.target))),
      () => attrs,
    )
    return () => nodes.value
  },
})
