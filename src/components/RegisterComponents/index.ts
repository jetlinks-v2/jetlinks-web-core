import { defineComponent, computed, h, Fragment, resolveComponent } from 'vue'
import { useRoute } from 'vue-router'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import {
  useRegistryVNodeMerge
} from '@jetlinks-web-core/hooks'

export default defineComponent({
  name: 'RegisterComponents',
  inheritAttrs: false,
  props: {
    code: { type: String, default: 'default' },
    is: { type: [Object, String], default: '' },
    activeKey: { type: [String, Number], default: '' }
  },
  setup(props, { slots, attrs }) {
    const route = useRoute()

    const registryItems = computed(() => {
      return componentsRegistry.getRegistry(
        `${route.name as string}:${props.code}`
      ) ?? []
    })

    /** vnodes 派生 */
    const mergedVNodes = useRegistryVNodeMerge(
      () => (slots.default ? slots.default() : []),
      () => registryItems.value
    )

    const renderContent = () => {
      if (!props.activeKey) return mergedVNodes.value

      // 保留组件状态，仅控制显示
      return mergedVNodes.value.map(node =>
        h('div', {
          style: {
            display: node.key === props.activeKey ? '' : 'none'
          }
        }, node)
      )
    }

    return () => {
      if (!props.is) return renderContent()

      const wrapper =
        typeof props.is === 'string'
          ? resolveComponent(props.is)
          : props.is || Fragment

      return h(wrapper as any, attrs, {
        default: () => renderContent()
      })
    }
  }
})
