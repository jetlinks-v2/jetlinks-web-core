<script setup lang="ts" name="TermsGroupItem">
import Terms from './Terms.vue'
import { ValueProps } from './Value/utils'
import { randomString } from '@jetlinks-web/utils'
import DropdownMenu from './DropdownMenu.vue'
import { typeOptions } from './utils'

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
  value: {
    source: 'manual',
    value: undefined
  },
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
    <div class="terms-scroll-area">
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
            :builtinOptions="builtinOptions"
            :builtinOptionsMap="builtinOptionsMap"
            :showValueType="showValueType"
            :fieldNames="fieldNames"
            @change="(val) => handleTermChange(index, val)"
          />

          <!-- 删除按钮 -->
          <div
            v-if="canDelete"
            class="delete-btn"
            @click.stop="handleDelete(index)"
          />
        </div>
      </template>

      <!-- 添加按钮 -->
      <div class="add-btn" @click="handleAdd" />
    </div>
  </div>
</template>

<style scoped lang="less">
// 变量定义
@spacing-unit: 8px;

.terms-group-container {
  width: 100%;
  position: relative;

  // 滚动区域容器
  .terms-scroll-area {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    padding: @spacing-unit 4px;
    gap: @spacing-unit;

    // 美化滚动条
    &::-webkit-scrollbar {
      height: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &:hover::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
    }
  }

  // 连接符 "并且"
  .connect-text {
    font-size: 12px;
    color: #999;
    font-weight: bold;
    flex-shrink: 0;
    user-select: none;
    margin: 0 2px;
  }

  // 条件项容器
  .term-item {
    position: relative;
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    cursor: default;

    &.can-delete:hover {
      border-color: #d1d5db;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

      // 悬停时显示删除按钮
      .delete-btn {
        opacity: 1;
        transform: scale(1);
      }
    }

    // 删除按钮
    .delete-btn {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 16px;
      height: 16px;
      background: #ff4d4f;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      cursor: pointer;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.2s ease;
      z-index: 10;
      box-shadow: 0 2px 4px rgba(255, 77, 79, 0.3);

      &:hover {
        background: #ff7875;
        transform: scale(1.1) !important;
      }

      // X 字符
      &::before {
        content: "×";
        font-family: Arial, sans-serif;
        line-height: 1;
        font-weight: bold;
      }
    }
  }

  // 添加按钮
  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px dashed #d9d9d9;
    border-radius: 4px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.3s;
    color: #666;
    flex-shrink: 0;
    margin-left: 4px;

    &:hover {
      border-color: #1890ff;
      color: #1890ff;
      background: #e6f7ff;
    }

    // + 符号
    &::before {
      content: "+";
      font-size: 18px;
      line-height: 1;
      margin-top: -2px;
    }
  }
}
</style>
