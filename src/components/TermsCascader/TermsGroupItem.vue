<script setup lang="ts" name="TermsGroupItem">
import Terms from './Terms.vue'
import { ValueProps } from './Value/utils'
import { randomString } from '@jetlinks-web/utils'
import DropdownMenu from './DropdownMenu.vue'
import { typeOptions } from './utils'
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
  column: undefined,
  type: 'and',
  termType: undefined,
  value: props.showValueType ? {
    source: 'manual',
    value: undefined
  } : undefined,
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
    <div class="term-item-box term-group-border">
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
          <Terms
            :value="item"
            v-bind="omit(props, ['value', 'minItems'])"
            @change="(val) => handleTermChange(index, val)"
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
  padding: 0.375rem 0.75rem;
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-2);
}
.terms-group-container .term-delete-btn {
  position: absolute;
  top: -0.625rem;
  right: -0.625rem;
  width: 1.25rem;
  height: 1.25rem;
  background: var(--bg-hover);
  color: var(--ink-4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-16);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s ease;
  z-index: 10;
}
.terms-group-container .term-delete-btn:hover {
  background: var(--bg-hover);
}
.terms-group-container .term-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  width: 1.5rem;
  height: 1.5rem;
  color: var(--ink-4);
  background-color: var(--bg);
  border: 1px dashed var(--ink-4);
  border-radius: 50%;
  cursor: pointer;
}
.terms-group-container .term-add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--info-bg);
}
.terms-group-container .term-add-btn::before {
  content: "+";
  font-size: var(--fs-20);
  line-height: 1;
  margin-top: -0.3125rem;
  margin-left: -0.0625rem;
}
.terms-group-container .connect-text {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--r-3);
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
  margin: 0 0.125rem;
}
.terms-group-container .term-item-box {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--space-3);
}
.terms-group-container .terms-scroll-area {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.75rem 0;
}
.terms-group-container .terms-scroll-area::-webkit-scrollbar {
  height: 0.375rem;
}
.terms-group-container .terms-scroll-area::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--ink-1) 10%, transparent);
  border-radius: var(--r-1);
}
.terms-group-container .terms-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.terms-group-container .terms-scroll-area:hover::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--ink-1) 20%, transparent);
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
  border-color: var(--line);
  box-shadow: var(--shadow-1);
}
.terms-group-container .term-item.can-delete:hover > .term-delete-btn {
  opacity: 1;
  transform: scale(1);
}</style>
