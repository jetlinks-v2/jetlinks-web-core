<script setup name="TermsCascaderValue">
import { ref, computed, watch } from 'vue'
import Fixed from './Fixed.vue'
import Builtin from './BuiltInParameters.vue'
import { useTermsParse, useTermsValue, useValueOptions } from '../hooks'
import { complexKey } from '../utils'
import { ValueProps } from './utils'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const props = defineProps({
  columnDetail: {
    type: Object,
    default: () => ({}),
  },
  index: {
    type: Number,
    default: 0,
  },
  ...ValueProps()
})

const emit = defineEmits(['update:value', 'change'])
const termsValue = useTermsValue()
const termsParse = useTermsParse()
const valueOptionsParse = useValueOptions()

const options = ref([
  { label: $t('ListItem.FilterCondition.9667711-7'), value: 'fixed', fieldName: 'fixed' },
  { label: $t('ListItem.FilterCondition.9667711-8'), value: 'upper', fieldName: 'upper' }
])
const source = ref(['fixed'])
const myValue = ref()
const valueOpen = ref(false)

const isComplex = computed(() => {
  return unref(termsValue).termType === complexKey
})

const typeLabel = computed(() => {
  return options.value.find(item => item.value === source.value[0])?.label
})

const showType = computed(() => {
  return !isComplex.value && props.showValueType
})

const dataType = computed(() => {
  return props.columnDetail?.dataType
})

const typeChange = (e) => {
  termsValue.value.value[props.fieldNames.valueSource] = e.key
}

const setValue = (value) => {
  if (Array.isArray(termsValue.value.value.value)) {
    termsValue.value.value.value[props.index] = value
  } else {
    termsValue.value.value.value = value
  }
}

const handleValueChange = (value) => {
  setValue(value)

  if (['enum', 'boolean', 'date', 'time'].includes(dataType.value)) {
    valueOpen.value = false
  }
}

const valueLabel = computed(() => {
  const value = myValue.value
  if (isComplex.value) {
    return value === 1 ? '请配置条件' : '条件'
  }

  let _label = value
  if (source.value[0] === 'fixed' && valueOptionsParse.value.options.length) {
    _label = valueOptionsParse.value.map.get(value)?.label
  } else if (props.builtinOptions.length) {
    _label = props.builtinOptionsMap.get(value)?.label
  }
  return _label || '参数值'
})

const handleParameterSelect = (node) => {
  // valueLabel.value = node.name
  console.log(node)
  setValue(node.column)
  valueOpen.value = false
}

const onValueOpenChange = (v) => {
  valueOpen.value = v;
}

watch(() => termsValue.value.value, (newValue) => {
  const fieldNames = props.fieldNames
  const _source = newValue[fieldNames.valueSource]
  source.value = _source ? [_source] : ['fixed']
  myValue.value = Array.isArray(newValue.value) ? newValue.value[props.index] : newValue.value
}, { immediate: true, deep: true })
</script>

<template>
  <div class="terms-cascader-value border-box terms-value" :class="{ 'only-fixed': !showType }">
    <a-dropdown v-if="showType" :trigger="['click']">
      <div class="terms-value--type">
        <a-space :size="2">
          <span>{{ typeLabel }}</span>
          <AIcon style="font-size: 12px" type="DownOutlined" />
        </a-space>
      </div>
      <template #overlay>
        <a-menu :selectedKeys="source" @click="typeChange">
          <a-menu-item v-for="item in options" :key="item.value">{{ item.label}}</a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
    <a-dropdown :trigger="['click']" :open="valueOpen"  @openChange="onValueOpenChange">
      <div class="terms-value--value">
        <j-ellipsis style="max-width: 220px">
          {{valueLabel}}
        </j-ellipsis>
      </div>
      <template #overlay>

        <Fixed
          v-if="source[0] === 'fixed'"
          :value="myValue"
          :dataType="dataType"
          :options="valueOptionsParse.options"
          @change="handleValueChange"
        />
        <Builtin
          v-else-if="source[0] !== 'fixed'"
          :value="myValue"
          :data="builtinOptions"
          @change="handleValueChange"
          @select="handleParameterSelect"
        />
      </template>
    </a-dropdown>
  </div>
</template>

<style scoped lang="less">
@import '../style/comm.less';
.terms-cascader-value {
  min-width: 160px;
  display: flex;

  .terms-value--type {
    padding: 4px 0;
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    text-align: center;
    width: 80px;
    cursor: default;
    border-right: 1px solid rgba(188, 125, 238, 0.5);
  }

  .terms-value--value {
    flex: 1 auto;
    min-width: 0;
    padding: 4px 0;
    height: 100%;
    text-align: center;
    cursor: default;
  }

  &.only-fixed {
    min-width: 80px;
  }

  .terms-value--dropdown {
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}
</style>
