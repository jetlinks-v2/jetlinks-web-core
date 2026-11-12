<template>
  <div class="model-config__files" :class="{ 'model-config__files--resizing': workspace.resizingSider }">
    <ModelFileDirectory
      v-model:selectedKeys="workspace.selectedKeys"
      v-model:selectedFormat="workspace.selectedFormat"
      :tree-data="workspace.treeData"
      :format-options="workspace.formatOptions"
      :format-names="workspace.formatNameMap"
      :locale="workspace.text"
      :files-loading="workspace.props.filesLoading"
      :show-add-file="workspace.props.showAddFile"
      :show-model-management="false"
      @select="workspace.onTreeSelect"
      @add-file="workspace.openAddFile"
    />
    <div
      class="model-config__resize"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="workspace.text.resizeFileDirectory"
      :aria-valuemin="workspace.SIDER_WIDTH_MIN"
      :aria-valuemax="workspace.SIDER_WIDTH_MAX"
      :aria-valuenow="workspace.siderWidth"
      @pointerdown="workspace.startResizeSider"
      @keydown.left.prevent="workspace.resizeSiderByKeyboard(-16)"
      @keydown.right.prevent="workspace.resizeSiderByKeyboard(16)"
      @keydown.home.prevent="workspace.setSiderWidth(workspace.SIDER_WIDTH_MIN)"
      @keydown.end.prevent="workspace.setSiderWidth(workspace.SIDER_WIDTH_MAX)"
    />
    <main class="model-config__main">
      <header class="model-config__content-head">
        <div class="model-config__content-title">
          <AIcon type="FileTextOutlined" />
          <span>{{ workspace.activeTitle }}</span>
        </div>
        <a-space v-if="workspace.selectedFile" wrap>
          <a-button :disabled="!workspace.selectedFile.url" @click="workspace.downloadSelectedFile">
            <AIcon type="DownloadOutlined" />
            {{ workspace.text.downloadFile }}
          </a-button>
          <ModelConfigActions
            v-if="(workspace.canEditFile && workspace.filePreviewLoaded) || workspace.editing"
            :workspace="workspace"
          />
          <a-button danger @click="workspace.openDeleteFileConfirm">
            <AIcon type="DeleteOutlined" />
            {{ workspace.text.delete }}
          </a-button>
          <a-button @click="workspace.toggleProperty">
            <AIcon :type="workspace.propertyVisible ? 'DoubleRightOutlined' : 'ProfileOutlined'" />
            {{ workspace.propertyVisible ? workspace.text.collapseProperty : workspace.text.viewProperty }}
          </a-button>
        </a-space>
      </header>
      <section class="model-config__editor-wrap">
        <MonacoEditor
          v-if="workspace.activeType === 'file' && workspace.showEditor"
          ref="editorRef"
          v-model:modelValue="workspace.editorValue"
          :key="workspace.editorKey"
          class="model-config__editor"
          theme="vs"
          :language="workspace.editorLanguage"
          :read-only="!workspace.editing"
          :blur-format="workspace.editorLanguage === 'json'"
          :options="{ minimap: { enabled: false }, wordWrap: 'on' }"
        />
        <div v-else class="model-config__preview">
          <a-result :title="workspace.previewResultTitle" :sub-title="workspace.previewResultDescription">
            <template #extra>
              <a-space v-if="workspace.selectedFile">
                <a-button
                  v-if="workspace.canEditFile && workspace.selectedFile.url"
                  type="primary"
                  :loading="workspace.contentLoading"
                  @click="workspace.previewFile"
                >
                  <AIcon type="EyeOutlined" />
                  {{ workspace.text.preview }}
                </a-button>
                <a-upload
                  v-else-if="!workspace.canEditFile"
                  :show-upload-list="false"
                  :before-upload="workspace.replaceFile"
                >
                  <a-button :loading="workspace.fileSaving">
                    <AIcon type="UploadOutlined" />
                    {{ workspace.text.replaceFile }}
                  </a-button>
                </a-upload>
              </a-space>
            </template>
          </a-result>
        </div>
      </section>
    </main>
    <aside v-if="workspace.propertyVisible && workspace.selectedFile" class="model-config__property">
      <SectionCard icon="ProfileOutlined" :title="workspace.text.fileProperty">
        <template #actions>
          <a-button type="link" size="small" @click="workspace.copyPath">
            <AIcon type="CopyOutlined" />
            {{ workspace.text.copyPath }}
          </a-button>
        </template>
        <KvGrid cols="stacked" cell-layout="inline" :items="workspace.propertyItems" />
      </SectionCard>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { PropType } from 'vue'
import MonacoEditor from '../../MonacoEditor/monacoEditor.vue'
import SectionCard from '../../SectionCard/index.vue'
import KvGrid from '../../KvGrid/index.vue'
import ModelFileDirectory from '../ModelFileDirectory.vue'
import ModelConfigActions from './ModelConfigActions.vue'
import type { ModelConfigWorkspace } from './useModelConfigWorkspace'

defineProps({ workspace: { type: Object as PropType<ModelConfigWorkspace>, required: true } })
const editorRef = ref<{ layout?: () => void }>()
// 父级仍使用同一个编辑器引用调度布局，文件内容和草稿不由展示组件另存一份。
defineExpose({ layout: () => editorRef.value?.layout?.() })
</script>

<style scoped lang="less" src="./modelFileWorkspace.less"></style>
