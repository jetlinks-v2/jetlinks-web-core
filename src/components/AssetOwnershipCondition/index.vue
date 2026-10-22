<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LoadingOutlined } from '@ant-design/icons-vue'
import type { SelectProps } from 'ant-design-vue'
import ConditionOptionPanel from '../ConditionFilter/ConditionOptionPanel.vue'
import { useAssetOwnershipCondition, type AssetOwnershipDisplay } from './useAssetOwnershipCondition'
import type { AssetOwnershipOptions, AssetOwnershipTerm } from './types'

const props = defineProps<{
  value?: AssetOwnershipTerm
  options: AssetOwnershipOptions
  /** 仅供用户打开后才挂载的弹层使用；独立挂载默认不加载。 */
  resumeOnMount?: boolean
}>()
const emit = defineEmits<{
  (event: 'update:value', value?: AssetOwnershipTerm): void
  (event: 'change', value?: AssetOwnershipTerm): void
  (event: 'submit'): void
  (event: 'display-change', display: AssetOwnershipDisplay): void
}>()
const { t } = useI18n()
const translate = (key: string, values?: Record<string, string>) => t(key, values || {})
const {
  loading, targetOpen, selector, draft, invalid, ranges, operators, targetMode, supportsClosure, preview, failure,
  activate, selectRange, selectOperator, selectTargets, openTargets, resumeEditing, submit,
} = useAssetOwnershipCondition(props, value => {
  emit('update:value', value)
  emit('change', value)
  emit('submit')
}, display => emit('display-change', display), translate)
const key = 'components.AssetOwnershipCondition.'
const choosingRange = ref(false)
const operatorOptions = computed(() => operators.value.map(value => ({ value, label: t(key + value) })))
const rangeName = computed(() => ranges.value.find(range => range.value === draft.value.rangeId)?.label
  || (draft.value.rangeId === 'creator' ? t(key + 'creator')
    : draft.value.rangeId === 'unbound' ? t(key + 'unboundRange')
    : draft.value.rangeId.startsWith('dimension:') ? draft.value.rangeId.slice(10) : t(key + 'placeholder')))
const needsTargets = computed(() => !!targetMode.value
  && ['targets', 'notTargets'].includes(draft.value.operator))
const onIdsChange = (value: SelectProps['value']) => selectTargets(Array.isArray(value)
  ? value.filter((id): id is string => typeof id === 'string') : [])
watch(() => props.options.assetType, () => { choosingRange.value = false })
onMounted(() => {
  if (props.resumeOnMount && props.value && !invalid.value) void resumeEditing()
})
const openRanges = () => {
  choosingRange.value = !choosingRange.value
  if (choosingRange.value) void activate()
}
const onRangeChange = async (value?: string) => {
  // 单选面板再次点击当前项会返回空值；范围选择只切换或返回，不清除已提交的条件。
  if (invalid.value || value && value !== draft.value.rangeId) selectRange(value ?? draft.value.rangeId)
  choosingRange.value = false
  if (needsTargets.value) await openTargets()
}
const onOperatorChange = async (value: unknown) => {
  const operator = operators.value.find(item => item === value)
  if (!operator) return
  selectOperator(operator)
  if (needsTargets.value && !targetOpen.value && !failure.value) await openTargets()
}
</script>

<template>
  <div class="asset-ownership-condition">
    <a-button class="asset-ownership-condition__range" :aria-busy="loading" @click="openRanges">
      <span class="asset-ownership-condition__label">{{ invalid ? t(key + 'placeholder') : rangeName }}</span>
      <span class="asset-ownership-condition__action">
        <span class="asset-ownership-condition__status"><LoadingOutlined v-if="loading" /></span>
        <span>{{ choosingRange ? t(key + 'back') : t(key + 'changeRange') }}</span>
      </span>
    </a-button>
    <ConditionOptionPanel
      v-if="choosingRange"
      :value="invalid ? undefined : draft.rangeId"
      :options="ranges"
      :config="{ multiple: false, showSearch: false }"
      @update:value="onRangeChange"
    />
    <template v-else>
      <a-segmented
        v-if="draft.rangeId.startsWith('dimension:') && !invalid && operatorOptions.length"
        :value="draft.operator" :options="operatorOptions" block @change="onOperatorChange"
      />
      <div v-if="value && !targetOpen" class="asset-ownership-condition__preview">{{ preview }}</div>
      <template v-if="needsTargets && !invalid">
        <a-checkbox v-if="supportsClosure && !(targetOpen && selector?.component)" v-model:checked="draft.closure">
          {{ t(key + 'includeDescendants') }}
        </a-checkbox>
        <template v-if="targetOpen && targetMode === 'input'">
          <a-select
            mode="tags" :value="draft.ids" :open="false" allow-clear
            :placeholder="t(key + 'idPlaceholder')" @update:value="onIdsChange"
          />
          <span class="asset-ownership-condition__preview">{{ t(key + 'idHint') }}</span>
          <a-button type="primary" :disabled="!draft.ids.length || !!failure" @click="submit">
            {{ t(key + 'apply') }}
          </a-button>
        </template>
        <template v-if="targetOpen && selector">
          <component
            :is="selector.component"
            v-if="selector.component"
            v-bind="selector.componentProps"
            :value="draft.ids"
            :options="selector.options"
            :config="selector.optionPanel"
            @update:value="selectTargets"
            @options-change="selector.onOptionsChange"
            @submit="submit"
          >
            <template v-if="supportsClosure" #selection-extra>
              <a-checkbox v-model:checked="draft.closure">{{ t(key + 'includeDescendants') }}</a-checkbox>
            </template>
          </component>
          <ConditionOptionPanel
            v-else
            :value="draft.ids"
            :options="selector.options"
            :config="selector.optionPanel"
            @update:value="selectTargets"
          />
          <a-button v-if="!selector.component" type="primary" :disabled="!draft.ids.length || !!failure" @click="submit">
            {{ t(key + 'apply') }}
          </a-button>
        </template>
        <a-button v-if="!targetOpen" :disabled="!!failure" @click="openTargets">{{ t(key + 'selectTargets') }}</a-button>
      </template>
    </template>
    <a-alert v-if="failure" type="warning" :message="t(key + failure)" show-icon>
      <template v-if="failure === 'contextFailed' || failure === 'optionsFailed'" #action>
        <a-button size="small" :loading="loading" @click="failure === 'contextFailed' ? resumeEditing() : openTargets()">{{ t(key + 'retry') }}</a-button>
      </template>
    </a-alert>
  </div>
</template>

<style scoped>
.asset-ownership-condition { display: flex; flex-direction: column; gap: var(--space-2); min-width: 15rem; }
.asset-ownership-condition__range { display: flex; align-items: center; gap: var(--space-2); text-align: left; }
.asset-ownership-condition__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.asset-ownership-condition__action { display: inline-flex; align-items: center; gap: var(--space-1); flex-shrink: 0; color: var(--color-jet-text-secondary); font-size: var(--fs-12); }
/* 加载图标使用固定槽位，避免快请求结束时按钮文字横向跳动。 */
.asset-ownership-condition__status { display: inline-flex; justify-content: center; width: 1em; }
.asset-ownership-condition__preview { color: var(--color-jet-text-secondary); overflow-wrap: anywhere; }
</style>
