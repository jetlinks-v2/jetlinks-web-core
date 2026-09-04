<script setup lang="ts">
import { computed, type PropType } from 'vue'

import { getSvgIcon, svgIconTypes, type SvgIconType } from './icons'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  type: {
    type: String as PropType<SvgIconType>,
    required: true,
    validator: (type: SvgIconType) => svgIconTypes.includes(type),
  },
})

const icon = computed(() => getSvgIcon(props.type))
</script>

<template>
  <component :is="icon" v-if="icon" v-bind="$attrs" />
</template>
