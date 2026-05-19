<script setup name="FilterItem">
import { useI18n } from 'vue-i18n'
import Column from './Column.vue';
import TermType from './TermType.vue';
import Value from './Value.vue';
import { useEngines } from './hooks/useSearchEngine'
import { isArrayTermType } from './setting'

const props = defineProps({
  column: {
    type: String,
    default: undefined,
  },
  type: {
    type: String,
    default: undefined,
  },
  termType: {
    type: String,
    default: undefined,
  },
  value: {
    type: [String, Number, Array],
    default: undefined,
  },
  index: {
    type: Number,
    default: 0,
  }
})

const { t: $t } = useI18n()

const typeOptions = computed(() => [
  { label: $t('components.SearchFilter.logic.and'), value: 'and'},
  { label: $t('components.SearchFilter.logic.or'), value: 'or'}
])

const convertValue = (oldTermType, newTermType, currentValue) => {
  if (oldTermType === newTermType) {
    return currentValue
  }

  const expectsArrayValue = isArrayTermType(newTermType)
  const isRangeType = ['btw', 'nbtw'].includes(newTermType)

  if (!expectsArrayValue) {
    return Array.isArray(currentValue) ? currentValue[0] : currentValue
  }

  if (currentValue === undefined || currentValue === null) {
    return undefined
  }

  if (Array.isArray(currentValue)) {
    if (isRangeType) {
      return [currentValue[0], currentValue[1] ?? undefined]
    }
    return [...currentValue]
  }

  return isRangeType ? [currentValue, undefined] : [currentValue]
}

const { updateTermValue, removeItem } = useEngines()
const typeOptionsMap = computed(() => {
  return typeOptions.value.reduce((acc, item) => {
    acc[item.value] = item.label
    return acc
  }, {})
})

const onTypeChange = ({ key }) => {
  updateTermValue(key, props.index, 'type')
}

const onTermTypeChange = (value) => {
  const convertedValue = convertValue(props.termType, value, props.value)
  updateTermValue(convertedValue, props.index, 'value')
  updateTermValue(value, props.index, 'termType')
}

const onValueChange = (value) => {
  updateTermValue(value, props.index, 'value')
}

const onCloseTermItem = () => {
  removeItem(props.index)
}

</script>

<template>
  <div class="filter-item">
    <a-dropdown trigger="click">
      <a-tag v-if="type && index !== 0" color="processing" style="margin: 0">
        {{ typeOptionsMap[type] }}
      </a-tag>
      <template #overlay>
        <a-menu style="width: 7.5rem" @click="onTypeChange">
          <a-menu-item v-for="option in typeOptions" :key="option.value">
            {{ option.label }}
          </a-menu-item>
        </a-menu>

      </template>
    </a-dropdown>
    <Column :value="column" />
    <TermType :column="column" :value="termType" @change="onTermTypeChange"/>
    <Value v-if="!!value" :column="column" :termType="termType" :value="value" @change="onValueChange" @close="onCloseTermItem" />
  </div>
</template>

<style scoped>
.filter-item {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  margin-right: var(--space-1);
}</style>
