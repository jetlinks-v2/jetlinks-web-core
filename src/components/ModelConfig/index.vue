<template>
  <div class="model-config" :style="workspace.modelConfigStyle">
    <SlantedTabs
      class="model-config__primary-tabs"
      :active-key="workspace.primaryTab"
      :options="workspace.primaryTabs"
      :state="{ loading: workspace.fileSaving }"
      preserve-disabled-active
      @change="workspace.changePrimaryTab"
    />
    <ContentPanel class="model-config__body" fill :padding="0">
      <!-- 目录保留实例以保持搜索和展开状态，文件编辑器仍按原规则卸载。 -->
      <ModelFileWorkspace v-show="workspace.activeType === 'file'" ref="fileWorkspaceRef" :workspace="workspace" />
      <template v-if="workspace.activeType === 'model'">
        <!-- 扩展页不缓存：切走时由原业务组件卸载并取消进行中的请求。 -->
        <div v-if="workspace.isExtraConfigTab" class="model-config__extra-content">
          <slot name="extra-config-content" :active-key="workspace.configTab" />
        </div>
        <section v-else class="model-config__configuration">
          <header
            v-if="workspace.configTab !== 'definition' || workspace.definitionViewMode === 'json' || $slots['definition-content']"
            class="model-config__configuration-head"
          >
            <span>{{ workspace.configTab === 'manifest' ? workspace.text.basicInfo : workspace.text.modelConfig }}</span>
            <ModelConfigActions :workspace="workspace" />
          </header>
          <div
            v-if="workspace.configTab === 'definition' && workspace.definitionViewMode === 'form'"
            class="model-config__definition-content"
          >
            <slot
              name="definition-content"
              :definition="workspace.definitionContent"
              :editing="workspace.editing"
              :files="workspace.files"
              :model="model"
              :update-definition="workspace.updateDefinitionContent"
            >
              <ModelParameterEditor
                ref="definitionEditorRef"
                :definition="workspace.definitionContent"
                :editing="workspace.editing"
                :files="workspace.files"
                :locale="workspace.text"
                @update:definition="workspace.updateDefinitionContent"
              >
                <template #actions><ModelConfigActions :workspace="workspace" /></template>
              </ModelParameterEditor>
            </slot>
          </div>
          <MonacoEditor
            v-else
            ref="editorRef"
            v-model:modelValue="workspace.editorValue"
            :key="workspace.editorKey"
            class="model-config__editor"
            theme="vs"
            language="json"
            :read-only="!workspace.editing"
            :blur-format="true"
            :options="{ minimap: { enabled: false }, wordWrap: 'on' }"
          />
        </section>
      </template>
    </ContentPanel>
    <a-modal
      :open="workspace.leaveConfirmVisible"
      :title="workspace.text.unsavedChangesTitle"
      :mask-closable="false"
      @cancel="workspace.cancelTabChange"
    >
      <p>{{ workspace.text.unsavedChangesMessage }}</p>
      <template #footer>
        <a-space>
          <a-button @click="workspace.cancelTabChange">{{ workspace.text.cancel }}</a-button>
          <a-button danger @click="workspace.discardAndChangeTab">{{ workspace.text.discard }}</a-button>
          <a-button type="primary" @click="workspace.saveAndChangeTab">{{ workspace.text.save }}</a-button>
        </a-space>
      </template>
    </a-modal>
    <AddFileModal
      :open="workspace.addFileVisible"
      :available-formats="availableFormats"
      :selected-owner="workspace.selectedOwner"
      :existing-files="workspace.files"
      :editable-extensions="workspace.editableExtensions"
      :locale="workspace.text"
      :show-batch-upload="workspace.showBatchUpload"
      :show-custom-create="workspace.showCustomCreate"
      @update:open="workspace.handleAddFileVisibleChange"
      @confirm="workspace.addFile"
      @batch-confirm="workspace.batchAddFile"
    >
      <template #custom-create-option><slot name="add-file-custom-create-option" /></template>
      <template #custom-create-content="slotProps">
        <slot name="add-file-custom-create-content" v-bind="slotProps" />
      </template>
    </AddFileModal>
  </div>
</template>

<script setup lang="ts">
import { reactive, useSlots } from 'vue'
import SlantedTabs from '../SlantedTabs'
import ContentPanel from '../ContentPanel/index.vue'
import MonacoEditor from '../MonacoEditor/monacoEditor.vue'
import ModelParameterEditor from '../ModelParameterEditor/index.vue'
import AddFileModal from './AddFileModal.vue'
import ModelConfigActions from './workspace/ModelConfigActions.vue'
import ModelFileWorkspace from './workspace/ModelFileWorkspace.vue'
import { modelConfigProps } from './workspace/types'
import type { ModelFile } from './modelFileDirectory'
import type { BatchAddFilePayload } from './batchFileUpload'
import type {
  AddFileEventPayload, LoadFilesPayload, PreviewFilePayload,
  ReplaceFilePayload, SaveConfigPayload, SaveFilePayload
} from './workspace/types'
import { useModelConfigWorkspace } from './workspace/useModelConfigWorkspace'

const props = defineProps(modelConfigProps)
// 保留内联事件声明，兼容构建中按匿名 SFC 解析宏的 setup-name-support 插件。
const emit = defineEmits<{
  (e: 'load-files', payload: LoadFilesPayload): void
  (e: 'save-config', payload: SaveConfigPayload): void
  (e: 'add-file', payload: AddFileEventPayload): void
  (e: 'batch-add-file', payload: BatchAddFilePayload): void
  (e: 'add-file-close'): void
  (e: 'save-file', payload: SaveFilePayload): void
  (e: 'replace-file', payload: ReplaceFilePayload): void
  (e: 'preview-file', payload: PreviewFilePayload): void
  (e: 'delete-file', file: ModelFile): void
}>()
const state = useModelConfigWorkspace(props, emit, useSlots())
// 引用直接指向原编辑器，拆分后保存前校验仍由 prepareForSave 唯一执行。
const { definitionEditorRef, editorRef, fileWorkspaceRef } = state
const workspace = reactive(state)
</script>

<style scoped lang="less" src="./workspace/modelConfig.less"></style>
