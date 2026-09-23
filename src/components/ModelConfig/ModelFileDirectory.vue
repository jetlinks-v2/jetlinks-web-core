<template>
  <aside class="model-config__sider">
    <div class="model-config__sider-head">
      <span class="model-config__title">{{ locale.fileDirectory }}</span>
      <div class="model-config__format-actions">
        <a-select
          :value="selectedFormat"
          class="model-config__format"
          :options="formatOptions"
          :placeholder="locale.selectFormat"
          size="small"
          @update:value="emit('update:selectedFormat', $event)"
        />
      </div>
    </div>

    <div class="model-config__actions">
      <a-input
        v-model:value="searchValue"
        class="model-config__search"
        :placeholder="locale.searchFiles"
        :aria-label="locale.searchFiles"
        allow-clear
      >
        <template #prefix><AIcon type="SearchOutlined" /></template>
      </a-input>
      <a-button v-if="showAddFile" block @click="emit('add-file', '')">
        <AIcon type="PlusOutlined" />
        {{ locale.addFile }}
      </a-button>
    </div>

    <a-spin
      wrapper-class-name="model-config__tree-spin"
      :spinning="filesLoading"
    >
      <!-- 筛选会移除节点，禁用过渡动画，避免动画中的旧节点读取已失效的父级信息。 -->
      <a-tree
        v-if="visibleTree.length"
        :selected-keys="selectedKeys"
        class="model-config__tree"
        :tree-data="visibleTree"
        :expanded-keys="expandedKeys"
        :motion="null"
        expand-action="doubleclick"
        :field-names="{ title: 'title', key: 'key', children: 'children' }"
        block-node
        @update:selectedKeys="emit('update:selectedKeys', $event)"
        @select="forwardSelection"
        @expand="setExpandedKeys"
      >
        <template #title="{ title, isFile, path, shared, file }">
          <span
            class="model-config__tree-node"
            :class="{ 'model-config__tree-node--tagged': hasFileTreeTags(file) }"
          >
            <span class="model-config__tree-node-main">
              <AIcon :type="getTreeNodeIcon(isFile, shared, file)" />
              <a-tooltip
                v-if="isFile"
                overlay-class-name="model-config__tree-file-tooltip"
              >
                <template #title>
                  <span class="model-config__tree-file-tooltip-content">
                    <span v-if="file?.path" class="model-config__tree-file-tooltip-path">{{ file.path }}</span>
                    <span class="model-config__tree-file-tooltip-name">{{ file?.name || title }}</span>
                  </span>
                </template>
                <span class="model-config__tree-node-title">{{ title }}</span>
              </a-tooltip>
              <span v-else class="model-config__tree-node-title">{{ title }}</span>
            </span>
            <span v-if="hasFileTreeTags(file)" class="model-config__tree-tags">
              <a-tooltip
                v-for="tag in getFileTreeTags(file)"
                :key="tag.key"
                :title="tag.title"
                overlay-class-name="model-config__tree-tag-tooltip"
              >
                <span :class="['model-config__tree-tag', `model-config__tree-tag--${tag.type}`]">
                  {{ tag.label }}
                </span>
              </a-tooltip>
            </span>
            <a-button
              v-if="!isFile"
              type="link"
              size="small"
              class="model-config__tree-add"
              @click.stop="emit('add-file', path)"
              @dblclick.stop
            >
              <AIcon type="PlusOutlined" />
            </a-button>
          </span>
        </template>
      </a-tree>
      <a-empty
        v-else
        class="model-config__empty"
        :description="isSearching ? locale.noMatchingFiles : locale.noFiles"
      />
    </a-spin>
    <div class="model-config__footer">
      <a-button
        block
        class="model-config__config-entry"
        :type="modelConfigActive ? 'primary' : 'default'"
        :aria-pressed="modelConfigActive"
        @click="emit('model-config')"
      >
        <AIcon type="SettingOutlined" />
        {{ locale.modelManagement }}
      </a-button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { FileDirectorySource, TreeNode } from './modelFileDirectory'
import { useModelFileDirectory } from './useModelFileDirectory'

const props = defineProps({
  treeData: { type: Array as PropType<TreeNode[]>, required: true },
  selectedKeys: { type: Array as PropType<string[]>, required: true },
  selectedFormat: { type: String, required: true },
  formatOptions: {
    type: Array as PropType<Array<{ label: string; value: string }>>,
    required: true
  },
  formatNames: { type: Object as PropType<Map<string, string>>, required: true },
  locale: { type: Object as PropType<FileDirectorySource['locale']>, required: true },
  filesLoading: { type: Boolean, default: false },
  showAddFile: { type: Boolean, default: true },
  modelConfigActive: { type: Boolean, default: false }
})

const emit = defineEmits<{
  (e: 'update:selectedKeys', keys: string[]): void
  (e: 'update:selectedFormat', format: string): void
  (e: 'select', keys: string[], info: { node?: TreeNode }): void
  (e: 'add-file', path?: string): void
  (e: 'model-config'): void
}>()

const {
  searchValue,
  isSearching,
  visibleTree,
  expandedKeys,
  setExpandedKeys,
  getTreeNodeIcon,
  hasFileTreeTags,
  getFileTreeTags
} = useModelFileDirectory(props)

function forwardSelection(keys: string[], info: { node?: TreeNode }) {
  emit('select', keys, info)
}
</script>

<style scoped lang="less" src="./modelFileDirectory.less"></style>
