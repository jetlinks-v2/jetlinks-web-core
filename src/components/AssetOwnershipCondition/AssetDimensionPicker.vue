<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ConditionOptionPanel from '../ConditionFilter/ConditionOptionPanel.vue'
import type { AssetDimensionSelector } from './types'

/** 只承载注册选择器的统一协议；数据、权限和目录结构仍由维度模块维护。 */
const props = defineProps<{
  selector: AssetDimensionSelector
  value: string[]
  multiple: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:value': [ids: string[]]; submit: [] }>()
const { t } = useI18n()
const config = computed(() => ({ ...props.selector.optionPanel, multiple: props.multiple }))
function update(value: unknown) {
  if (props.disabled) return
  const ids = [
    ...new Set((Array.isArray(value) ? value : [value]).filter((id): id is string => typeof id === 'string' && !!id))
  ]
  emit('update:value', props.multiple ? ids.slice(0, 200) : ids.slice(-1))
}
function submit() {
  if (!props.disabled && props.value.length) emit('submit')
}
</script>
<template>
  <fieldset
    class="asset-dimension-picker"
    :disabled="disabled"
  >
    <component
      :is="selector.component"
      v-if="selector.component"
      v-bind="selector.componentProps"
      :value="value"
      :options="selector.options"
      :config="config"
      @update:value="update"
      @submit="submit"
    />
    <template v-else>
      <ConditionOptionPanel
        :value="value"
        :options="selector.options"
        :config="config"
        @update:value="update"
      />
      <a-button
        type="primary"
        :disabled="disabled || !value.length"
        @click="submit"
      >
        {{ t('components.AssetOwnershipCondition.apply') }}
      </a-button>
    </template>
  </fieldset>
</template>
<style scoped>
.asset-dimension-picker {
  display: grid;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
</style>
