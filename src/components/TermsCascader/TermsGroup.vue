<script setup lang="ts" name="TermsCascaderGroup">
import TermsGroupItem from './TermsGroupItem.vue'
import { ValueProps } from './Value/utils'
import { randomString } from '@jetlinks-web/utils'
import { typeOptions } from './utils'
import DropdownMenu from './DropdownMenu.vue'
import { omit } from 'lodash-es'

interface TermItem {
  column?: string
  type: string
  termType?: string
  value?: {
    source: string
    value: any
  }
  options?: any[]
  terms?: TermItem[]
  key: string
  error?: boolean
}

const emit = defineEmits(['change', 'update:value'])
const props = defineProps({
  value: {
    type: Array as PropType<TermItem[]>,
    default: () => []
  },
  minItems: {
    type: Number,
    default: 1
  },
  ...ValueProps()
})

const termsList = ref<TermItem[]>([])

// 生成唯一 key
const generateKey = () => {
  return `params_${randomString()}`
}

// 创建默认条件项
const createDefaultTerm = (): TermItem => ({
  type: 'and',
  terms: [
    {
      column: undefined,
      type: 'and',
      termType: undefined,
      value: props.showValueType ? {
        source: 'fixed',
        value: undefined
      } : undefined,
      key: randomString()
    }
  ],
  key: generateKey()
})

// 添加条件项
const handleAdd = () => {
  termsList.value.push(createDefaultTerm())
  emitChange()
}

// 删除条件项
const handleDelete = (index: number) => {
  if (termsList.value.length > props.minItems) {
    termsList.value.splice(index, 1)
    emitChange()
  }
}

// 条件项变更
const handleTermChange = (index: number, newValue: any) => {
  termsList.value[index] = {
    ...termsList.value[index],
    ...newValue
  }
  emitChange()
}

// 触发变更事件
const emitChange = () => {
  emit('update:value', termsList.value)
  emit('change', termsList.value)
}

// 判断是否可删除
const canDelete = computed(() => termsList.value.length > props.minItems)

// 初始化
watch(() => props.value, (newValue) => {
  if (newValue && newValue.length > 0) {
    termsList.value = newValue.map(item => ({
      ...item,
      key: item.key || generateKey()
    }))
  } else {
    termsList.value = [createDefaultTerm()]
  }
}, { immediate: true, deep: true })
</script>

<template>
  <div class="terms-group-container">
    <div class="term-item-box terms-scroll-area">
      <template v-for="(item, index) in termsList" :key="item.key">
        <!-- 连接符 -->
        <span v-if="index > 0" class="connect-text">
          <DropdownMenu :options="typeOptions" v-model:value="item.type" />
        </span>

        <!-- 条件项 -->
        <div
          class="term-item"
          :class="{ 'can-delete': canDelete }"
        >
          <TermsGroupItem
            v-model:value="item.terms"
            v-bind="omit(props, ['value', 'minItems'])"
            @change="emitChange"
          />

          <!-- 删除按钮 -->
          <div
            v-if="canDelete"
            class="term-delete-btn"
            @click.stop="handleDelete(index)"
          >
            <AIcon type="CloseOutlined" />
          </div>
        </div>
      </template>

      <!-- 添加按钮 -->
      <div class="term-add-btn" @click="handleAdd" />
    </div>
  </div>
</template>

<style scoped>
.terms-group-container {
  width: 100%;
  position: relative;
}
.terms-group-container .term-group-border {
  padding: 6px 12px;
  border: 1px dashed #e0e0e0;
  border-radius: 6px;
}
.terms-group-container .term-delete-btn {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 20px;
  height: 20px;
  background: #f1f1f1;
  color: #999;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s ease;
  z-index: 10;
}
.terms-group-container .term-delete-btn:hover {
  background: #f3f3f3;
}
.terms-group-container .term-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  width: 24px;
  height: 24px;
  color: rgba(0, 0, 0, 0.3);
  background-color: #fff;
  border: 1px dashed rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  cursor: pointer;
}
.terms-group-container .term-add-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
  background: #e6f7ff;
}
.terms-group-container .term-add-btn::before {
  content: "+";
  font-size: 20px;
  line-height: 1;
  margin-top: -5px;
  margin-left: -1px;
}
.terms-group-container .connect-text {
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
  margin: 0 2px;
}
.terms-group-container .term-item-box {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
}
.terms-group-container .terms-scroll-area {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 12px 0;
}
.terms-group-container .terms-scroll-area::-webkit-scrollbar {
  height: 6px;
}
.terms-group-container .terms-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
.terms-group-container .terms-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.terms-group-container .terms-scroll-area:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}
.terms-group-container .term-item {
  position: relative;
  display: flex;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  cursor: default;
}
.terms-group-container .term-item.can-delete:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.terms-group-container .term-item.can-delete:hover > .term-delete-btn {
  opacity: 1;
  transform: scale(1);
}
</style>
